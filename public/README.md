# Model Files

This directory should contain the YOLOv8n ONNX model file.

## Required Files:
- `yolov8n.onnx` - Quantized YOLOv8n model for WASM inference

## How to Get the Model:
1. Download YOLOv8n from: https://github.com/ultralytics/ultralytics/releases
2. Convert to ONNX format using Ultralytics
3. Quantize for WASM compatibility
4. Place the resulting `yolov8n.onnx` file in this directory

## Alternative:
For testing purposes, you can use a smaller model or create a mock model file.
