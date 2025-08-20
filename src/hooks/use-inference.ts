'use client';

import React from 'react';
import * as ort from 'onnxruntime-web';
import { useStore } from '@/lib/store';
import type { RawMetric, Detection } from '@/lib/types';
import { detectObjects } from '@/ai/flows/server-object-detection';
import { MODEL_URL, MODEL_INPUT_SHAPE } from '@/lib/constants';

// Memoize the session to avoid reloading the model on every render
let session: ort.InferenceSession | null = null;
let sessionError: string | null = null;

const getSession = async () => {
    if (session) return session;
    if (sessionError) throw new Error(sessionError);
    
    try {
        console.log('[useInference] Checking ONNX model availability at:', MODEL_URL);
        // Check that the model file is present and reachable before creating session.
        try {
            const res = await fetch(MODEL_URL, { method: 'HEAD' });
            if (!res.ok) {
                const msg = `ONNX model not found at ${MODEL_URL} (status ${res.status})`;
                console.error('[useInference]', msg);
                sessionError = msg;
                throw new Error(msg);
            }
        } catch (fetchErr) {
            const msg = `Failed to fetch ONNX model at ${MODEL_URL}: ${fetchErr}`;
            console.error('[useInference]', msg);
            sessionError = msg;
            throw new Error(msg);
        }

        console.log('[useInference] Loading ONNX model from:', MODEL_URL);
        const newSession = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        });
        session = newSession;
        console.log('[useInference] ONNX model loaded successfully');
        return session;
    } catch (e) {
        const errorMsg = `Failed to create ONNX session: ${e}`;
        console.error(errorMsg);
        sessionError = errorMsg;
        throw new Error(errorMsg);
    }
};

const useInference = (videoRef: React.RefObject<HTMLVideoElement>) => {
    const { mode, addRawMetric, setDetections, detections } = useStore();
    const [inferenceBusy, setInferenceBusy] = React.useState(false);
    const [latestFrame, setLatestFrame] = React.useState<ImageBitmap | null>(null);

    const onNewFrame = React.useCallback(async (frame: ImageBitmap) => {
        setLatestFrame(frame);
    }, []);

    const runWasmInference = React.useCallback(async (frame: ImageBitmap) => {
        try {
            const inferenceSession = await getSession();
            if (!inferenceSession) {
                console.warn('[useInference] No inference session available');
                return [];
            }

            console.log('[useInference] Running WASM inference on frame:', frame.width, 'x', frame.height);
            const { data, width, height } = preprocess(frame);
            const tensor = new ort.Tensor('float32', data, MODEL_INPUT_SHAPE);
            const feeds = { images: tensor };
            
            const results = await inferenceSession.run(feeds);
            const detections = postprocess(results.output0.data as Float32Array, width, height);
            
            console.log('[useInference] WASM inference completed, found', detections.length, 'detections');
            return detections;
        } catch (error) {
            console.error('[useInference] WASM inference failed:', error);
            // Return empty detections on error
            return [];
        }
    }, []);

    const runServerInference = React.useCallback(async (frame: ImageBitmap) => {
        try {
            console.log('[useInference] Running server inference on frame:', frame.width, 'x', frame.height);
            
            const canvas = document.createElement('canvas');
            canvas.width = frame.width;
            canvas.height = frame.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn('[useInference] Could not get canvas context for server inference');
                return [];
            }
            ctx.drawImage(frame, 0, 0);

            const frameDataUri = canvas.toDataURL('image/jpeg', 0.8);
            console.log('[useInference] Frame converted to data URI, length:', frameDataUri.length);

            const result = await detectObjects({
                frameDataUri,
                frameId: Date.now().toString(),
                captureTs: Date.now(), // This is technically inference request time
                recvTs: Date.now(), // on server, but we don't know that here
            });

            console.log('[useInference] Server inference completed, found', result.detections.length, 'detections');
            return result.detections.map(d => ({...d, model: 'server' as const}));
        } catch (error) {
            console.error('[useInference] Server inference failed:', error);
            // Return empty detections on error
            return [];
        }
    }, []);

    React.useEffect(() => {
        const scheduleInference = async () => {
            if (inferenceBusy || !latestFrame) return;

            console.log('[useInference] Starting inference for frame:', latestFrame.width, 'x', latestFrame.height, 'in', mode, 'mode');
            setInferenceBusy(true);
            const frameToProcess = latestFrame;
            setLatestFrame(null); // Consume the frame

            const captureTs = Date.now();
            let newDetections: Detection[] = [];
            
            try {
                 if (mode === 'wasm') {
                    console.log('[useInference] Running WASM inference...');
                    newDetections = await runWasmInference(frameToProcess);
                } else {
                    console.log('[useInference] Running server inference...');
                    newDetections = await runServerInference(frameToProcess);
                }
                
                console.log('[useInference] Inference completed, got', newDetections.length, 'detections');
            } catch (e) {
                console.error(`[useInference] Inference failed in ${mode} mode`, e);
            } finally {
                frameToProcess.close();
                const inferenceTs = Date.now();
                const overlayTs = Date.now();
                
                console.log('[useInference] Setting detections and metrics');
                setDetections(newDetections);
                
                const metric: RawMetric = {
                  captureTs,
                  inferenceTs,
                  overlayTs,
                };
                addRawMetric(metric);
                
                setInferenceBusy(false);
            }
        };

        const intervalId = setInterval(scheduleInference, 1000/30); // try to run inference up to 30fps
        return () => clearInterval(intervalId);

    }, [inferenceBusy, latestFrame, mode, addRawMetric, setDetections, runWasmInference, runServerInference]);

    // Frame capture loop
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        console.log('[useInference] Setting up frame capture for video:', video.videoWidth, 'x', video.videoHeight);
        let animationFrameId: number;

        const captureFrame = async () => {
            if (video.readyState >= 2 && video.videoWidth > 0 && !inferenceBusy) {
                try {
                    const frame = await createImageBitmap(video);
                    console.log('[useInference] Captured frame:', frame.width, 'x', frame.height);
                    onNewFrame(frame);
                } catch(e) {
                    console.error("[useInference] Could not create image bitmap", e);
                }
            }
            animationFrameId = requestAnimationFrame(captureFrame);
        };

        video.onloadedmetadata = () => {
             console.log('[useInference] Video metadata loaded, starting frame capture');
             animationFrameId = requestAnimationFrame(captureFrame);
        }
        
        return () => {
            if (animationFrameId) {
                console.log('[useInference] Cleaning up frame capture');
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [videoRef, onNewFrame, inferenceBusy]);

    return { detections };
};

export default useInference;


// Pre-processing and Post-processing for YOLOv8 ONNX model
function preprocess(frame: ImageBitmap) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const [w, h] = MODEL_INPUT_SHAPE.slice(2);
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(frame, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;

    const red = [], green = [], blue = [];
    for (let i = 0; i < data.length; i += 4) {
        red.push(data[i] / 255);
        green.push(data[i+1] / 255);
        blue.push(data[i+2] / 255);
    }
    const float32Data = [...red, ...green, ...blue];
    return { data: new Float32Array(float32Data), width: frame.width, height: frame.height };
}

// COCO classes for YOLO
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 
  'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 
  'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

function postprocess(output: Float32Array, originalWidth: number, originalHeight: number): Detection[] {
    const detections: Detection[] = [];
    const [modelWidth, modelHeight] = MODEL_INPUT_SHAPE.slice(2);
    const boxes: Array<{label: string, score: number, box: number[]}> = [];

    // Transpose the output
    const outputT: number[][] = [];
    for(let i=0; i < 84; ++i) { // 84 channels for YOLOv8 (4 box, 80 classes)
        outputT[i] = [];
        for(let j=0; j < 8400; ++j) { // 8400 detections
            outputT[i][j] = output[i + j*84];
        }
    }

    for (let i = 0; i < 8400; i++) {
        const x = outputT[0]?.[i] || 0;
        const y = outputT[1]?.[i] || 0;
        const w = outputT[2]?.[i] || 0;
        const h = outputT[3]?.[i] || 0;
        
        const scores: number[] = [];
        for(let j = 4; j < 84; j++) {
            scores.push(outputT[j]?.[i] || 0);
        }
        
        let maxScore = 0;
        let maxIndex = -1;
        for(let j=0; j<scores.length; ++j) {
            if(scores[j] > maxScore) {
                maxScore = scores[j];
                maxIndex = j;
            }
        }

        if (maxScore > 0.7 && maxIndex >= 0) { // Confidence threshold
            const x1 = ((x - w / 2) / modelWidth) * originalWidth;
            const y1 = ((y - h / 2) / modelHeight) * originalHeight;
            const x2 = ((x + w / 2) / modelWidth) * originalWidth;
            const y2 = ((y + h / 2) / modelHeight) * originalHeight;

            boxes.push({
                label: COCO_CLASSES[maxIndex] || 'unknown',
                score: maxScore,
                box: [
                    x1 / originalWidth, y1 / originalHeight, x2 / originalWidth, y2 / originalHeight
                ]
            });
        }
    }
    
    // Non-Maximum Suppression (a simplified version)
    boxes.sort((a,b) => b.score - a.score);
    const result: {label: string, score: number, box: number[]}[] = [];
    while(boxes.length > 0) {
        result.push(boxes[0]);
        const newBoxes: typeof boxes = [];
        for(let i = 1; i < boxes.length; i++) {
            if(iou(boxes[0].box, boxes[i].box) < 0.5) {
                newBoxes.push(boxes[i]);
            }
        }
        boxes.splice(0, boxes.length, ...newBoxes);
    }

    return result.map(r => ({
        label: r.label,
        score: r.score,
        xmin: r.box[0],
        ymin: r.box[1],
        xmax: r.box[2],
        ymax: r.box[3],
        model: 'wasm' as const,
    }));
}

function iou(boxA: number[], boxB: number[]) {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[2], boxB[2]);
    const yB = Math.min(boxA[3], boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);

    const boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
    const boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);

    const iou = interArea / (boxAArea + boxBArea - interArea);
    return iou;
}

