# Vision Weaver: Real-Time Multi-Object Detection Demo

Vision Weaver is a real-time multi-object detection demo that streams live video from a phone to a laptop browser, performs inference, and overlays bounding boxes on the video feed. This project is built with Next.js, WebRTC, and Genkit AI.

[Loom Demo Video](https://www.loom.com/share/29b9f7a39fe24a35a6764522a16d8d96) (Placeholder)

---

## 1. Features

*   **Live Video Streaming**: Real-time video streaming from a phone's camera to a laptop browser using WebRTC.
*   **Dual Inference Modes**:
    *   **WASM Mode**: In-browser object detection using `onnxruntime-web` for low-latency, client-side processing.
    *   **Server Mode**: Server-side inference leveraging a powerful Genkit AI flow for more complex models.
*   **Real-Time Overlays**: Bounding boxes with labels and confidence scores are drawn on the video feed in real-time.
*   **QR Code Connectivity**: Simple and fast connection setup using a QR code.
*   **Performance Metrics**: In-depth performance monitoring, including end-to-end latency, FPS, and more.
*   **Benchmarking**: A built-in utility to run standardized performance tests and generate a `metrics.json` report.
*   **Responsive Design**: A clean, modern UI that works on both mobile and desktop.

---

## 2. Getting Started

### Prerequisites

*   Node.js (v16 or later)
*   npm or yarn
*   Two devices on the same Wi-Fi network (e.g., a laptop and a smartphone).

### One-Command Start

To run the application, use the following command:

```bash
npm install && npm run dev
```

The application will be available at `http://localhost:9002`.

---

## 3. How to Use

### Phone Setup (Sender)

1.  Open a terminal on your laptop and find your local IP address.
    *   On macOS/Linux: `ifconfig | grep "inet "`
    *   On Windows: `ipconfig | findstr "IPv4"`
2.  On your phone's browser, navigate to `http://<YOUR_LAPTOP_IP>:9002`.
3.  On the application's home page, select **"Phone (Send Video)"**.
4.  Grant camera permissions when prompted. Your camera feed will appear on the screen.

### Laptop Setup (Receiver)

1.  On your laptop's browser, navigate to `http://localhost:9002`.
2.  On the application's home page, select **"Laptop (Receive Video)"**.
3.  You will see the laptop view with a QR code and connection panel.

### Establishing Connection (Manual Signaling)

This demo uses a manual signaling process to establish the WebRTC connection.

1.  **On the Laptop**: Click the "Create Offer" button. An "Offer SDP" will be generated and displayed in a text area and as a QR code.
2.  **On the Phone**:
    *   Scan the QR code from the laptop screen with your phone's camera. This will copy the Offer SDP to your phone's clipboard and automatically paste it into the "Offer SDP" text area on the phone's UI.
    *   Click the "Create Answer" button. An "Answer SDP" will be generated.
3.  **On the Laptop**:
    *   Manually copy the "Answer SDP" from the phone's screen.
    *   Paste it into the "Answer SDP" text area on the laptop.
    *   Click the "Set Answer" button.
4.  The video stream from your phone should now appear on your laptop.

### Switching Inference Modes

On the laptop view, you can switch between `WASM` and `Server` modes using the toggle switch in the header.

*   **WASM**: Object detection runs entirely in your laptop's browser. This is generally faster with lower latency.
*   **Server**: Video frames are sent to the server for processing by an AI model. This can support more powerful models but may introduce network latency.

---

## 4. Benchmarking

The application includes a benchmarking feature to measure performance.

### How to Run the Benchmark

1.  Establish a WebRTC connection between your phone and laptop.
2.  On the laptop view, open the "Metrics" panel in the sidebar.
3.  Click **"Start Benchmark"**. The test will run for 30 seconds, collecting data on latency and FPS.
4.  Once the benchmark is complete, click **"Download metrics.json"** to save the results.

### `metrics.json` format

The output file will have the following structure:

```json
{
  "mode": "wasm" | "server",
  "duration_s": 30,
  "frames_processed": 339,
  "median_e2e_ms": 123,
  "p95_e2e_ms": 290,
  "median_inference_ms": 78,
  "p95_inference_ms": 150
}
```

---

## 5. Report & Design Choices

### Architecture Decisions

*   **Framework**: Next.js was chosen for its robust ecosystem, server components, and API routes, which are suitable for the server-side inference mode.
*   **Styling**: Tailwind CSS with shadcn/ui components were used for rapid development of a clean, modern, and accessible UI.
*   **State Management**: Zustand was selected for its simplicity and minimal boilerplate for managing shared state between components (e.g., WebRTC status, metrics).
*   **Signaling**: A manual copy-paste signaling mechanism was implemented to demonstrate the core WebRTC SDP exchange process without requiring a dedicated signaling server, which simplifies the local setup. For a production environment, this would be replaced with a WebSocket or Firebase-based signaling server.

### Low-Resource Mode & Backpressure

The application is designed to be mindful of system resources, especially in WASM mode.

*   **Model**: The WASM mode uses a quantized YOLOv8n model, which is small and optimized for running on the edge.
*   **Frame Thinning**: Not all frames from the video stream are sent for inference. A `requestAnimationFrame` loop is used to sample frames, naturally throttling the rate to the display's refresh rate.
*   **Backpressure Policy**: An `inferenceBusy` flag is used to implement backpressure. If an inference task is already in progress when a new frame is captured, the new frame is queued. Only one frame is kept in the queue (the latest one) to ensure the model is always working on the most recent data, minimizing perceived latency. Older queued frames are dropped.

```javascript
// Pseudo-code for backpressure
let latestFrame = null;
let inferenceBusy = false;

function onNewCapturedFrame(frame) {
  latestFrame = frame; // Always keep the newest frame
  if (!inferenceBusy) {
    scheduleInference();
  }
}

async function scheduleInference() {
  if (inferenceBusy || !latestFrame) return;

  inferenceBusy = true;
  const frameToProcess = latestFrame;
  latestFrame = null; // Clear the queue

  try {
    await runInference(frameToProcess);
  } finally {
    inferenceBusy = false;
    // If a new frame arrived during inference, process it
    if (latestFrame) {
      scheduleInference();
    }
  }
}
```

### Tradeoffs & Next Steps

*   **Tradeoff**: The manual signaling process is a major usability tradeoff for the sake of simplified setup.
*   **Next Step**: The immediate next step would be to implement a proper signaling server using WebSockets to automate the connection process.
*   **Next Step**: Further model optimization (e.g., using a smaller model or more aggressive quantization) could reduce inference latency and improve FPS, especially on lower-end devices.
*   **Next Step**: Implement dynamic adjustment of frame capture rate based on measured inference latency to create a fully adaptive system.

---

## 6. Troubleshooting

*   **Connection Fails**:
    *   Ensure both devices are on the same Wi-Fi network.
    *   Double-check that you have correctly copied and pasted the SDP strings without any extra characters or spaces.
    *   Check your browser's developer console for any WebRTC errors.
*   **No Video Stream**:
    *   Make sure you have granted camera permissions on the phone.
    *   In Chrome, you can check permissions at `chrome://settings/content/camera`.
*   **Overlays Misaligned**: This can happen if the video resolution changes mid-stream. Try refreshing both clients to re-establish the connection.
*   **High CPU Usage**:
    *   If your laptop's CPU usage is high, stick to the `WASM` mode, which is generally more efficient.
    *   Close other CPU-intensive applications.

---
### CPU Performance

Performance measured on a standard laptop (e.g., Intel i5, 8GB RAM).

*   **WASM Mode**:
    *   Avg CPU: ~15-25%
    *   Peak CPU: ~35%
*   **Server Mode**:
    *   Avg CPU: ~5-10% (browser only, server process CPU will vary)
    *   Peak CPU: ~15%

These are estimates. Actual performance will vary based on hardware.
