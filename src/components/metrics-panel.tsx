'use client';

import React from 'react';
import { BarChart, Download, Play, Square } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const MetricItem = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="font-mono text-sm font-medium">{value}</p>
  </div>
);

export default function MetricsPanel() {
  const { mode, metrics, isBenchmarking, setIsBenchmarking, setMetrics, rawMetrics } = useStore();

  const handleBenchmark = () => {
    if (isBenchmarking) {
      setIsBenchmarking(false);
    } else {
      setMetrics({
          framesProcessed: 0,
          medianE2EMs: 0,
          p95E2EMs: 0,
          medianInferenceMs: 0,
          p95InferenceMs: 0,
      });
      setIsBenchmarking(true);
    }
  };

  const downloadMetrics = () => {
    const data = {
      mode,
      duration_s: 30,
      frames_processed: metrics.framesProcessed,
      median_e2e_ms: metrics.medianE2EMs,
      p95_e2e_ms: metrics.p95E2EMs,
      median_inference_ms: metrics.medianInferenceMs,
      p95_inference_ms: metrics.p95InferenceMs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metrics.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full w-full rounded-none border-0 lg:rounded-lg lg:border">
      <CardHeader className="flex-row items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-6 w-6" />
            Performance Metrics
          </CardTitle>
          <CardDescription>Real-time inference and latency data.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold">Live Stats</h4>
          <MetricItem label="Mode" value={mode.toUpperCase()} />
          <MetricItem label="FPS (processed)" value={rawMetrics.fps.toFixed(1)} />
          <MetricItem label="E2E Latency (ms)" value={rawMetrics.e2eLatency.toFixed(0)} />
          <MetricItem label="Inference Latency (ms)" value={rawMetrics.inferenceLatency.toFixed(0)} />
        </div>
        <Separator />
        <div className="space-y-3">
          <h4 className="font-semibold">Benchmark (30s)</h4>
          <div className="flex gap-2">
          <Button onClick={handleBenchmark} className="w-full">
            {isBenchmarking ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isBenchmarking ? `Running... (${metrics.framesProcessed})` : 'Start Benchmark'}
          </Button>
          <Button onClick={downloadMetrics} variant="outline" className="w-full" disabled={isBenchmarking || metrics.framesProcessed === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download metrics.json
          </Button>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <MetricItem label="Frames Processed" value={metrics.framesProcessed} />
            <Separator className="my-1" />
            <MetricItem label="Median E2E Latency" value={`${metrics.medianE2EMs.toFixed(0)} ms`} />
            <MetricItem label="p95 E2E Latency" value={`${metrics.p95E2EMs.toFixed(0)} ms`} />
            <Separator className="my-1" />
            <MetricItem label="Median Inference Latency" value={`${metrics.medianInferenceMs.toFixed(0)} ms`} />
            <MetricItem label="p95 Inference Latency" value={`${metrics.p95InferenceMs.toFixed(0)} ms`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
