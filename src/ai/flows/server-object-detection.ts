'use server';

/**
 * @fileOverview An object detection AI agent that runs on the server.
 *
 * - detectObjects - A function that handles the object detection process.
 * - DetectObjectsInput - The input type for the detectObjects function.
 * - DetectObjectsOutput - The return type for the detectObjects function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectObjectsInputSchema = z.object({
  frameDataUri: z
    .string()
    .describe(
      "A frame from the video, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  frameId: z.string().describe('The unique identifier for the frame.'),
  captureTs: z.number().describe('The timestamp when the frame was captured (ms).'),
  recvTs: z.number().describe('The timestamp when the frame was received by the server (ms).'),
});
export type DetectObjectsInput = z.infer<typeof DetectObjectsInputSchema>;

const DetectionSchema = z.object({
  label: z.string().describe('The label of the detected object.'),
  score: z.number().describe('The confidence score of the detection.'),
  xmin: z.number().describe('The normalized x coordinate of the top-left corner of the bounding box.'),
  ymin: z.number().describe('The normalized y coordinate of the top-left corner of the bounding box.'),
  xmax: z.number().describe('The normalized x coordinate of the bottom-right corner of the bounding box.'),
  ymax: z.number().describe('The normalized y coordinate of the bottom-right corner of the bounding box.'),
});

const DetectObjectsOutputSchema = z.object({
  frameId: z.string().describe('The unique identifier for the frame.'),
  captureTs: z.number().describe('The timestamp when the frame was captured (ms).'),
  recvTs: z.number().describe('The timestamp when the frame was received by the server (ms).'),
  inferenceTs: z.number().describe('The timestamp when the inference finished (ms).'),
  detections: z.array(DetectionSchema).describe('The array of detected objects.'),
});
export type DetectObjectsOutput = z.infer<typeof DetectObjectsOutputSchema>;

export async function detectObjects(input: DetectObjectsInput): Promise<DetectObjectsOutput> {
  return detectObjectsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectObjectsPrompt',
  input: {schema: DetectObjectsInputSchema},
  output: {schema: DetectObjectsOutputSchema},
  prompt: `You are an expert in object detection. You receive a frame from a video stream and you need to identify the objects present in the frame and return
the bounding box detections.

Frame ID: {{{frameId}}}
Capture Timestamp: {{{captureTs}}}
Receive Timestamp: {{{recvTs}}}
Frame Data URI: {{media url=frameDataUri}}

Consider objects with a confidence score above 0.7.
Return the results in JSON format.
`,
});

const detectObjectsFlow = ai.defineFlow(
  {
    name: 'detectObjectsFlow',
    inputSchema: DetectObjectsInputSchema,
    outputSchema: DetectObjectsOutputSchema,
  },
  async input => {
    const inferenceTs = Date.now();
    const {output} = await prompt({...input, inferenceTs});
    return output!;
  }
);
