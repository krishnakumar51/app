// The URL to the ONNX model file.
// This model is a quantized version of YOLOv8n.
// It's recommended to host this model on a CDN for production use.
export const MODEL_URL = "/yolov8n.onnx";

// The input shape of the model [batch_size, channels, height, width].
export const MODEL_INPUT_SHAPE = [1, 3, 640, 640];
