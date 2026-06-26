// Central config. Defaults line up with the docker stack in ../docker
// (postgres admin/admin on :5432 db `dslab`, redis on :6379, otel-collector
// OTLP HTTP on :4318). Override via env vars.

export const config = {
  // Set per-process by the npm scripts (gateway | backend | client).
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'otel-demo',
  otlp: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    // Export often so a short run shows up in Grafana quickly.
    exportIntervalMs: Number(process.env.OTEL_EXPORT_INTERVAL_MS ?? 5000),
  },
  gateway: {
    port: Number(process.env.GATEWAY_PORT ?? 3001),
    url: process.env.GATEWAY_URL ?? 'http://localhost:3001',
  },
  backend: {
    port: Number(process.env.BACKEND_PORT ?? 3002),
    url: process.env.BACKEND_URL ?? 'http://localhost:3002',
  },
  pg: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'admin',
    password: process.env.PGPASSWORD ?? 'admin',
    database: process.env.PGDATABASE ?? 'dslab',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  // Client load shape.
  load: {
    concurrency: Number(process.env.LOAD_CONCURRENCY ?? 4),
    intervalMs: Number(process.env.LOAD_INTERVAL_MS ?? 250),
  },
};
