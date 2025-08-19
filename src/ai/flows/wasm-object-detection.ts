'use server';

/**
 * @fileOverview Implements object detection in the browser using a quantized model.
 *
 * - wasmObjectDetection - A function that performs object detection using a WASM model.
 * - WasmObjectDetectionInput - The input type for the wasmObjectDetection function.
 * - WasmObjectDetectionOutput - The return type for the wasmObjectDetection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WasmObjectDetectionInputSchema = z.object({
  frameDataUri: z
    .string()
    .describe(
      "A video frame, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type WasmObjectDetectionInput = z.infer<typeof WasmObjectDetectionInputSchema>;

const WasmObjectDetectionOutputSchema = z.object({
  detections: z.array(
    z.object({
      label: z.string(),
      score: z.number(),
      xmin: z.number(),
      ymin: z.number(),
      xmax: z.number(),
      ymax: z.number(),
    })
  ),
});
export type WasmObjectDetectionOutput = z.infer<typeof WasmObjectDetectionOutputSchema>;

export async function wasmObjectDetection(input: WasmObjectDetectionInput): Promise<WasmObjectDetectionOutput> {
  return wasmObjectDetectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'wasmObjectDetectionPrompt',
  input: {schema: WasmObjectDetectionInputSchema},
  output: {schema: WasmObjectDetectionOutputSchema},
  prompt: `You are an expert object detector that will parse video frames and identify objects.

You will use this information to detect objects in the video frame and identify their labels and bounding box coordinates.

Frame: {{media url=frameDataUri}}`,
});

const wasmObjectDetectionFlow = ai.defineFlow(
  {
    name: 'wasmObjectDetectionFlow',
    inputSchema: WasmObjectDetectionInputSchema,
    outputSchema: WasmObjectDetectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
