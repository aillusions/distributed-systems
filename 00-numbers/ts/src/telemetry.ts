// OpenTelemetry metrics setup. Exports OTLP HTTP metrics to the otel-collector
// (which re-exposes them on :8889 for Prometheus to scrape → Grafana).
//
// We define two instruments, both tagged with `target` (pg|redis) and
// `op` (read|write) so every panel can slice reads vs writes per backend:
//   - ops_total       counter   → RPS via rate()
//   - op_duration_ms  histogram → latency percentiles via histogram_quantile()

import { metrics } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationType,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from './config.js';

// Explicit ms buckets so latency percentiles are meaningful across the range
// we expect (sub-ms cache hits up to multi-second tail).
const LATENCY_BUCKETS_MS = [
  0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

const reader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: `${config.otlp.endpoint}/v1/metrics`,
  }),
  exportIntervalMillis: config.otlp.exportIntervalMs,
});

const provider = new MeterProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.otlp.serviceName,
  }),
  readers: [reader],
  views: [
    {
      instrumentName: 'op_duration_ms',
      aggregation: {
        type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
        options: { boundaries: LATENCY_BUCKETS_MS },
      },
    },
  ],
});

metrics.setGlobalMeterProvider(provider);

// Emits process.cpu.time (→ process_cpu_time in Prometheus) plus other
// process/system gauges, so we can see whether the load generator's own Node
// process is the bottleneck rather than the backend.
new HostMetrics({ meterProvider: provider, name: config.otlp.serviceName }).start();

const meter = metrics.getMeter('numbers-lab');

export const opsTotal = meter.createCounter('ops_total', {
  description: 'Total DB/cache operations',
});

export const opDurationMs = meter.createHistogram('op_duration_ms', {
  description: 'Operation latency in milliseconds',
  unit: 'ms',
});

export type OpLabels = {
  target: 'pg' | 'redis';
  op: 'read' | 'write';
  status: 'ok' | 'error';
};

// Record one operation's outcome + latency in a single place.
export function record(labels: OpLabels, durationMs: number): void {
  opsTotal.add(1, labels);
  // Histogram only carries target/op — status lives on the counter so error
  // rate stays queryable without fragmenting the latency distribution.
  opDurationMs.record(durationMs, { target: labels.target, op: labels.op });
}

// Flush the last batch before the process exits, otherwise a short run's final
// few seconds of data never leave the SDK.
export async function shutdownTelemetry(): Promise<void> {
  await provider.forceFlush();
  await provider.shutdown();
}
