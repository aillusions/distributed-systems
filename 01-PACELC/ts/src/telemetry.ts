// OpenTelemetry metrics for the PACELC timeline. Exports OTLP HTTP to the
// otel-collector (re-exposed on :8889 for Prometheus → Grafana :3005).
//
// The timeline driver mutates `state` as it runs; the observable gauges sample
// it on each export. Counters/histograms are recorded inline per operation.
import { metrics } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationType,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from './config.js';

// Wide buckets: sub-ms async commits up to a multi-second blocked sync commit.
const WRITE_BUCKETS_MS = [
  0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000,
];

const reader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({ url: `${config.otlp.endpoint}/v1/metrics` }),
  exportIntervalMillis: config.otlp.exportIntervalMs,
});

const provider = new MeterProvider({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: config.otlp.serviceName }),
  readers: [reader],
  views: [
    {
      instrumentName: 'pacelc_write_duration_ms',
      aggregation: {
        type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
        options: { boundaries: WRITE_BUCKETS_MS },
      },
    },
  ],
});

metrics.setGlobalMeterProvider(provider);
const meter = metrics.getMeter('pacelc-lab');

// Live state the driver updates; gauges below read it at each export tick.
export const state = {
  primaryN: 0, // latest value committed on the primary
  replicaN: 0, // value currently served by the replica
  standbyConnected: 0, // 1 while the standby is streaming
  partitioned: 0, // 1 while the replication link is cut
  syncMode: 0, // 1 while synchronous_standby_names is set
  experiment: '1-el' as '1-el' | '2-ap' | '3-cp' | 'pause', // current experiment ('pause' = between)
};

// Experiment-scoped metrics carry the `experiment` label so each dashboard
// block can filter to its own window. When the timeline moves on, the prior
// label's series stops being observed and expires (collector metric_expiration),
// so it disappears from the other blocks.
meter
  .createObservableGauge('pacelc_primary_n', { description: 'Latest counter value committed on the primary' })
  .addCallback((r) => r.observe(state.primaryN, { experiment: state.experiment }));
meter
  .createObservableGauge('pacelc_replica_n', { description: 'Counter value currently served by the replica' })
  .addCallback((r) => r.observe(state.replicaN, { experiment: state.experiment }));

// System-state gauges are deliberately UNtagged so the context panel draws one
// continuous line across all three experiments.
meter
  .createObservableGauge('pacelc_standby_connected', { description: '1 while the standby is streaming, 0 when partitioned away' })
  .addCallback((r) => r.observe(state.standbyConnected));
meter
  .createObservableGauge('pacelc_partitioned', { description: '1 while the replication link is cut' })
  .addCallback((r) => r.observe(state.partitioned));
meter
  .createObservableGauge('pacelc_sync_mode', { description: '1 while synchronous replication is enabled' })
  .addCallback((r) => r.observe(state.syncMode));

const writeHist = meter.createHistogram('pacelc_write_duration_ms', {
  description: 'Primary write (commit) latency',
  unit: 'ms',
});
export const recordWrite = (ms: number): void => writeHist.record(ms, { experiment: state.experiment });

// Flush the final batch before exit, else the last seconds never leave the SDK.
export async function shutdownTelemetry(): Promise<void> {
  await provider.forceFlush();
  await provider.shutdown();
}
