// OpenTelemetry metrics for the PACELC timeline. Exports OTLP HTTP to the
// otel-collector (re-exposed on :8889 for Prometheus → Grafana :3005).
//
// The timeline driver mutates `state` as it runs; the observable gauges sample
// it on each export. Counters/histograms are recorded inline per operation.
import { metrics } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AggregationTemporality,
  AggregationType,
  InstrumentType,
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

// Delta temporality for the gauges: once an experiment ends and its label-set
// is no longer observed, the SDK stops re-sending it (cumulative async gauges
// otherwise carry every label value forward forever, leaving flat lines after
// the experiment is over). Keep the histogram CUMULATIVE so the collector's
// Prometheus exporter still accepts it (it rejects delta histograms).
const exporter = new OTLPMetricExporter({ url: `${config.otlp.endpoint}/v1/metrics` });
exporter.selectAggregationTemporality = (instrumentType) =>
  instrumentType === InstrumentType.HISTOGRAM
    ? AggregationTemporality.CUMULATIVE
    : AggregationTemporality.DELTA;

const reader = new PeriodicExportingMetricReader({
  exporter,
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
  blockedSince: null as number | null, // ms-timestamp a write started, while it's still in flight
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
// How long the current write has been in flight (0 when none). Climbs while a
// synchronous commit is stalled behind a partition, then drops when it returns.
meter
  .createObservableGauge('pacelc_write_blocked_ms', {
    description: 'Age of the in-flight write (0 when none); climbs during a blocked synchronous commit',
    unit: 'ms',
  })
  .addCallback((r) =>
    r.observe(state.blockedSince == null ? 0 : Date.now() - state.blockedSince, {
      experiment: state.experiment,
    }),
  );

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
