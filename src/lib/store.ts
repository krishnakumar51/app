'use client';

import { create } from 'zustand';
import type { AppState, Role, Mode, Metrics, RawMetric } from './types';

function calculatePercentile(arr: number[], percentile: number) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  if (Number.isInteger(index)) {
    return sorted[index];
  }
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}


export const useStore = create<AppState>((set, get) => ({
  role: undefined,
  setRole: (role: Role) => set({ role }),

  mode: 'wasm',
  setMode: (mode: Mode) => set({ mode }),

  peerConnection: null,
  setPeerConnection: (peerConnection) => set({ peerConnection }),

  localStream: null,
  setLocalStream: (localStream) => set({ localStream }),

  remoteStream: null,
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  
  offerSdp: '',
  setOfferSdp: (offerSdp) => set({ offerSdp }),
  
  answerSdp: '',
  setAnswerSdp: (answerSdp) => set({ answerSdp }),

  connectionState: 'new',
  setConnectionState: (connectionState) => set({ connectionState }),

  detections: [],
  setDetections: (detections) => {
    console.log('[Store] Setting detections:', detections.length, 'detections');
    set({ detections });
  },

  metrics: {
    framesProcessed: 0,
    medianE2EMs: 0,
    p95E2EMs: 0,
    medianInferenceMs: 0,
    p95InferenceMs: 0,
  },
  setMetrics: (metrics) => set({ metrics }),

  rawMetrics: {
    e2eLatencies: [],
    inferenceLatencies: [],
    lastFrameTime: 0,
    frameCount: 0,
    fps: 0,
    e2eLatency: 0,
    inferenceLatency: 0,
  },
  
  isBenchmarking: false,
  benchmarkStartTime: 0,
  setIsBenchmarking: (isBenchmarking) => {
    if (isBenchmarking) {
      set({ 
        isBenchmarking, 
        benchmarkStartTime: Date.now(),
        rawMetrics: { ...get().rawMetrics, e2eLatencies: [], inferenceLatencies: [] } 
      });
    } else {
       // Finalize benchmark
      const { rawMetrics } = get();
      const medianE2EMs = calculatePercentile(rawMetrics.e2eLatencies, 50);
      const p95E2EMs = calculatePercentile(rawMetrics.e2eLatencies, 95);
      const medianInferenceMs = calculatePercentile(rawMetrics.inferenceLatencies, 50);
      const p95InferenceMs = calculatePercentile(rawMetrics.inferenceLatencies, 95);
      
      set({ 
        isBenchmarking,
        metrics: {
          framesProcessed: rawMetrics.e2eLatencies.length,
          medianE2EMs,
          p95E2EMs,
          medianInferenceMs,
          p95InferenceMs,
        }
      });
    }
  },

  addRawMetric: (metric: RawMetric) => {
    const { isBenchmarking, benchmarkStartTime, rawMetrics } = get();
    const now = Date.now();
    
    // Live stats update
    const newFrameCount = rawMetrics.frameCount + 1;
    const timeDiff = now - rawMetrics.lastFrameTime;
    let fps = rawMetrics.fps;
    if (timeDiff > 1000) {
      fps = newFrameCount / (timeDiff / 1000);
      set({ rawMetrics: {...rawMetrics, frameCount: 0, lastFrameTime: now, fps }});
    } else {
      set({ rawMetrics: {...rawMetrics, frameCount: newFrameCount }});
    }

    const e2eLatency = metric.overlayTs - metric.captureTs;
    const inferenceLatency = metric.inferenceTs - metric.captureTs;

    set(state => ({
        rawMetrics: {
            ...state.rawMetrics,
            e2eLatency,
            inferenceLatency
        }
    }));


    if (isBenchmarking) {
      if (now - benchmarkStartTime > 30000) { // 30 second benchmark
        get().setIsBenchmarking(false);
        return;
      }
      
      set(state => ({
        rawMetrics: {
            ...state.rawMetrics,
            e2eLatencies: [...state.rawMetrics.e2eLatencies, e2eLatency],
            inferenceLatencies: [...state.rawMetrics.inferenceLatencies, inferenceLatency]
        },
        metrics: {
          ...state.metrics,
          framesProcessed: state.rawMetrics.e2eLatencies.length + 1,
        }
      }));
    }
  },

}));
