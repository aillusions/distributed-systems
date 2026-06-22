// Central config. Defaults line up with the docker stack in /docker
// (postgres admin/admin on :5432 db `dslab`, redis on :6379, otel-collector
// OTLP HTTP on :4318). Override any of these via env vars.

export const config = {
  pg: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'admin',
    password: process.env.PGPASSWORD ?? 'admin',
    database: process.env.PGDATABASE ?? 'dslab',
    // Pool defaults to match the load generator's concurrency so the pool is
    // never the bottleneck — every worker gets its own connection.
    max: Number(process.env.PG_POOL_MAX ?? 200),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    topic: process.env.KAFKA_TOPIC ?? 'dslab.stress',
    partitions: Number(process.env.KAFKA_PARTITIONS ?? 6),
  },
  redpanda: {
    brokers: (process.env.REDPANDA_BROKERS ?? 'localhost:19092').split(','),
    topic: process.env.REDPANDA_TOPIC ?? 'dslab.stress',
    partitions: Number(process.env.REDPANDA_PARTITIONS ?? 6),
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    queue: process.env.RABBITMQ_QUEUE ?? 'dslab.stress',
  },
  // Payload size (bytes) of each published kafka/rabbitmq message.
  payloadBytes: Number(process.env.PAYLOAD_BYTES ?? 256),
  // Messages per produce request for kafka/redpanda phases (1 = no batching).
  // Batching amortizes per-request overhead — the main throughput lever.
  brokerBatch: Number(process.env.BROKER_BATCH ?? 100),
  otlp: {
    // The PeriodicExportingMetricReader appends /v1/metrics.
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    // Export often so a short run still shows up in Grafana quickly.
    exportIntervalMs: Number(process.env.OTEL_EXPORT_INTERVAL_MS ?? 2000),
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'numbers-lab-ts',
  },
  // Size of the seeded keyspace that reads sample from.
  keyspace: Number(process.env.KEYSPACE ?? 100_000),
};
