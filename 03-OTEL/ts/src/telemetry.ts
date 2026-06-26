// OpenTelemetry bootstrap for ALL THREE signals. This module must be the very
// first import in every entrypoint (backend/gateway/client) so the SDK starts
// and patches http/express/pg/ioredis/pino *before* they are required.
//
//   traces   → OTLP → collector → Tempo
//   metrics  → OTLP → collector → Prometheus   (exemplars carry trace_id)
//   logs     → OTLP → collector → Loki         (pino lines, trace-correlated)
//
// Auto-instrumentation gives us spans for inbound/outbound HTTP, pg and redis
// for free, plus W3C trace-context propagation across the gateway→backend hop
// (that propagation is what makes the trace *distributed*). The pino
// instrumentation injects trace_id/span_id into every log line and forwards it
// to the OTLP logs pipeline.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { config } from './config';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${config.otlp.endpoint}/v1/traces`,
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${config.otlp.endpoint}/v1/metrics`,
    }),
    exportIntervalMillis: config.otlp.exportIntervalMs,
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: `${config.otlp.endpoint}/v1/logs` }),
    ),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Noisy and irrelevant to the demo.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

const shutdown = () => {
  sdk.shutdown().finally(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
