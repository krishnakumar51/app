# **App Name**: Vision Weaver

## Core Features:

- Phone Camera Stream: Phone View: Capture and stream camera feed via WebRTC.
- Video Stream Display: Laptop View: Receive video stream and display it.
- Bounding Box Overlays: Display bounding box overlays on the video feed, aligned using frame metadata.
- WASM Object Detection: Inference Mode (WASM): Perform object detection directly in the browser using a quantized model.
- Server Object Detection: Inference Mode (Server): Send video frames to a server for object detection, receive results, and display overlays.
- QR Code Generation: Generate a QR code and short URL for easy phone connection.
- Performance Benchmarking: Run a benchmark script to measure end-to-end latency, server latency, and FPS; save to metrics.json.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to evoke a sense of reliability and technological sophistication. Chosen because this app has a focus on performance and metrics and should signal the reliability of the application. Avoids teal because that color was banned in the prompt.
- Background color: Light gray (#F0F0F0), providing a clean, neutral backdrop for the video feed and overlays.
- Accent color: Vivid orange (#FF9800) to highlight object detections and key UI elements.
- Body and headline font: 'Inter', a grotesque-style sans-serif, for a modern, machined look suitable for UI elements.
- Use clear and simple icons for settings and mode selection; avoid intricate designs.
- Divide the UI into logical sections for video display, overlay controls, and metrics; keep a clean arrangement.
- Subtle animations for loading indicators and mode transitions to enhance user experience.