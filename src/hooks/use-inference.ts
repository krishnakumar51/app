'use client';

import React from 'react';
import * as ort from 'onnxruntime-web';
import { useStore } from '@/lib/store';
import type { RawMetric, Detection } from '@/lib/types';
import { detectObjects } from '@/ai/flows/server-object-detection';
import { MODEL_URL, MODEL_INPUT_SHAPE } from '@/lib/constants';
import {_} from 'zod';

// Memoize the session to avoid reloading the model on every render
let session: ort.InferenceSession | null = null;
const getSession = async () => {
    if (session) return session;
    try {
        const newSession = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
        });
        session = newSession;
        return session;
    } catch (e) {
        console.error("Failed to create ONNX session", e);
        return null;
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
        const inferenceSession = await getSession();
        if (!inferenceSession) return [];

        const { data, width, height } = preprocess(frame);
        const tensor = new ort.Tensor('float32', data, MODEL_INPUT_SHAPE);
        const feeds = { images: tensor };
        
        const results = await inferenceSession.run(feeds);
        const detections = postprocess(results.output0.data as Float32Array, width, height);

        return detections;
    }, []);

    const runServerInference = React.useCallback(async (frame: ImageBitmap) => {
        const canvas = document.createElement('canvas');
        canvas.width = frame.width;
        canvas.height = frame.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        ctx.drawImage(frame, 0, 0);

        const frameDataUri = canvas.toDataURL('image/jpeg', 0.8);

        const result = await detectObjects({
            frameDataUri,
            frameId: Date.now().toString(),
            captureTs: Date.now(), // This is technically inference request time
            recvTs: Date.now(), // on server, but we don't know that here
        });

        return result.detections.map(d => ({...d, model: 'server'} as Detection));
    }, []);

    React.useEffect(() => {
        const scheduleInference = async () => {
            if (inferenceBusy || !latestFrame) return;

            setInferenceBusy(true);
            const frameToProcess = latestFrame;
            setLatestFrame(null); // Consume the frame

            const captureTs = Date.now();
            let newDetections: Detection[] = [];
            
            try {
                 if (mode === 'wasm') {
                    newDetections = await runWasmInference(frameToProcess);
                } else {
                    newDetections = await runServerInference(frameToProcess);
                }
            } catch (e) {
                console.error(`Inference failed in ${mode} mode`, e);
            } finally {
                frameToProcess.close();
                const inferenceTs = Date.now();
                setDetections(newDetections);
                
                const metric: RawMetric = {
                  captureTs,
                  inferenceTs,
                  overlayTs: Date.now(),
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

        let animationFrameId: number;

        const captureFrame = async () => {
            if (video.readyState >= 2 && video.videoWidth > 0 && !inferenceBusy) {
                try {
                    const frame = await createImageBitmap(video);
                    onNewFrame(frame);
                } catch(e) {
                    console.error("Could not create image bitmap", e);
                }
            }
            animationFrameId = requestAnimationFrame(captureFrame);
        };

        video.onloadedmetadata = () => {
             animationFrameId = requestAnimationFrame(captureFrame);
        }
        
        return () => {
            if (animationFrameId) {
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
    const boxes = [];

    // Transpose the output
    const outputT = [];
    for(let i=0; i < 84; ++i) { // 84 channels for YOLOv8 (4 box, 80 classes)
        outputT[i] = [];
        for(let j=0; j < 8400; ++j) { // 8400 detections
            outputT[i][j] = output[i + j*84];
        }
    }

    for (let i = 0; i < 8400; i++) {
        const [x, y, w, h] = outputT.slice(0, 4).map(d => d[i]);
        const scores = outputT.slice(4, 84).map(d => d[i]);
        
        let maxScore = 0;
        let maxIndex = -1;
        for(let j=0; j<scores.length; ++j) {
            if(scores[j] > maxScore) {
                maxScore = scores[j];
                maxIndex = j;
            }
        }

        if (maxScore > 0.7) { // Confidence threshold
            const x1 = ((x - w / 2) / modelWidth) * originalWidth;
            const y1 = ((y - h / 2) / modelHeight) * originalHeight;
            const x2 = ((x + w / 2) / modelWidth) * originalWidth;
            const y2 = ((y + h / 2) / modelHeight) * originalHeight;

            boxes.push({
                label: COCO_CLASSES[maxIndex],
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
        const newBoxes = [];
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
        model: 'wasm',
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

