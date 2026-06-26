// Plain pino. The OTel pino instrumentation (wired in telemetry.ts) does the
// rest: stamps each line with trace_id/span_id and ships it to Loki via OTLP.
import pino from 'pino';

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.OTEL_SERVICE_NAME ?? 'otel-demo' },
});
