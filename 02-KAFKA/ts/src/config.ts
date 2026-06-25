// Defaults line up with docker-compose.yml in the parent folder: the three
// brokers' EXTERNAL listeners on the host, toxiproxy admin on :8475, and the
// otel-collector OTLP HTTP endpoint on :4320.
export const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ??
      'localhost:19092,localhost:29092,localhost:39092').split(','),
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
