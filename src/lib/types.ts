export type Role = 'laptop' | 'phone' | undefined;
export type Mode = 'wasm' | 'server';

export interface Detection {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  model: Mode;
}

export interface Metrics {
  framesProcessed: number;
  medianE2EMs: number;
  p95E2EMs: number;
  medianInferenceMs: number;
  p95InferenceMs: number;
}

export interface RawMetric {
  captureTs: number;
  inferenceTs: number;
  overlayTs: number;
}

export interface RawMetrics {
    e2eLatencies: number[];
    inferenceLatencies: number[];
    lastFrameTime: number;
    frameCount: number;
    fps: number;
    e2eLatency: number;
    inferenceLatency: number;
}

export interface AppState {
  role: Role;
  setRole: (role: Role) => void;

  mode: Mode;
  setMode: (mode: Mode) => void;

  peerConnection: RTCPeerConnection | null;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;

  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;

  remoteStream: MediaStream | null;
  setRemoteStream: (stream: MediaStream | null) => void;
  
  offerSdp: string;
  setOfferSdp: (sdp: string) => void;

  answerSdp: string;
  setAnswerSdp: (sdp: string) => void;

  connectionState: RTCPeerConnectionState;
  setConnectionState: (state: RTCPeerConnectionState) => void;

  detections: Detection[];
  setDetections: (detections: Detection[]) => void;

  metrics: Metrics;
  setMetrics: (metrics: Metrics) => void;
  
  rawMetrics: RawMetrics;
  
  isBenchmarking: boolean;
  benchmarkStartTime: number;
  setIsBenchmarking: (isBenchmarking: boolean) => void;

  addRawMetric: (metric: RawMetric) => void;
}
