// Defaults line up with docker-compose.yml in the parent folder:
// primary on :5432 (writes), replica on :5433 (reads), toxiproxy admin on :8474.
export const config = {
  primary: {
    host: process.env.PRIMARY_HOST ?? 'localhost',
    port: Number(process.env.PRIMARY_PORT ?? 5432),
    user: 'admin',
    password: 'admin',
    database: 'dslab',
  },
  replica: {
    host: process.env.REPLICA_HOST ?? 'localhost',
    port: Number(process.env.REPLICA_PORT ?? 5433),
    user: 'admin',
    password: 'admin',
    database: 'dslab',
  },
  toxiproxy: {
    url: process.env.TOXIPROXY_URL ?? 'http://localhost:8474',
    proxy: 'pg-replication',
  },
  otlp: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    exportIntervalMs: Number(process.env.OTEL_EXPORT_INTERVAL_MS ?? 1000),
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'pacelc-lab-ts',
  },
};
