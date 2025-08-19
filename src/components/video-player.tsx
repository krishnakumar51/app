'use client';

import React from 'react';
import useInference from '@/hooks/use-inference';
import { useStore } from '@/lib/store';
import type { Detection } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export function drawOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Detection[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((d) => {
    const x = d.xmin * canvas.width;
    const y = d.ymin * canvas.height;
    const w = (d.xmax - d.xmin) * canvas.width;
    const h = (d.ymax - d.ymin) * canvas.height;
    ctx.strokeStyle = 'hsl(var(--accent))';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.font = '14px Inter';
    const label = `${d.label} ${Math.round(d.score * 100)}%`;
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = 14;

    ctx.fillStyle = 'hsla(var(--accent), 0.7)';
    ctx.fillRect(x, y - textHeight - 4, textWidth + 8, textHeight + 4);

    ctx.fillStyle = 'hsl(var(--primary-foreground))';
    ctx.fillText(label, x + 4, y - 4);
  });
}

export default function VideoPlayer() {
  const { remoteStream } = useStore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  const { detections } = useInference(videoRef);

  React.useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);
  
  React.useEffect(() => {
    if (canvasRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
      drawOverlay(canvasRef.current, videoRef.current, detections);
    }
  }, [detections]);

  return (
    <div className="relative aspect-video w-full max-w-full overflow-hidden rounded-lg border bg-black shadow-lg">
      {!remoteStream && <Skeleton className="h-full w-full" />}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 h-full w-full"
      />
    </div>
  );
}
