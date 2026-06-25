// Defaults line up with docker-compose.yml in the parent folder: the five
// brokers' EXTERNAL listeners on the host (:19092-:19096), toxiproxy admin on
// :8475, and the otel-collector OTLP HTTP endpoint on :4320.
export const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ??
      'localhost:19092,localhost:19093,localhost:19094,localhost:19095,localhost:19096').split(','),
    clientId: process.env.KAFKA_CLIENT_ID ?? 'kafka-lab',
  },
  toxiproxy: {
    url: process.env.TOXIPROXY_URL ?? 'http://localhost:8475',
  },
  otlp: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4320',
    exportIntervalMs: Number(process.env.OTEL_EXPORT_INTERVAL_MS ?? 1000),
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'kafka-lab-ts',
  },
};
