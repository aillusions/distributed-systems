// Load generator. Runs every backend/op combination sequentially by default
// (pg write, pg read, redis write, redis read) so a single run lights up all
// series in Grafana. Each phase drives traffic at a fixed concurrency for a
// fixed duration, recording RPS + latency to OTLP.
//
//   pnpm load                                  # all four phases, sequentially
//   pnpm load --concurrency 50 --duration 20   # same, tuned
//
// Reads and writes show up as separate series per backend in the
// "Numbers — DB & Redis load" dashboard.

import { ensureSchema, pool, closePg } from './pg.js';
import { redis, redisKey, closeRedis } from './redis.js';
import { producer, connectKafka, closeKafka } from './kafka.js';
import { redpandaProducer, connectRedpanda, closeRedpanda } from './redpanda.js';
import { connectRabbit, publishRabbit, closeRabbit } from './rabbitmq.js';
import { record, shutdownTelemetry, type OpLabels } from './telemetry.js';
import { config } from './config.js';

type Target = 'pg' | 'redis' | 'kafka' | 'redpanda' | 'rabbitmq';
type Op = 'read' | 'write';

// Run all combinations in this order. Writes first so reads have fresh data.
// Brokers are send-only, so they only appear as writes.
const PHASES: Array<{ target: Target; op: Op }> = [
  { target: 'pg', op: 'write' },
  { target: 'pg', op: 'read' },
  { target: 'redis', op: 'write' },
  { target: 'redis', op: 'read' },
  { target: 'kafka', op: 'write' },
  { target: 'redpanda', op: 'write' },
  { target: 'rabbitmq', op: 'write' },
];

const payload = Buffer.alloc(config.payloadBytes, 'x');

// Fixed per-phase duration. Kept well above Grafana's rate() window so the
// displayed RPS isn't diluted by idle time around a short run.
const DURATION_S = 30;

function parseArgs(argv: string[]): { concurrency: number } {
  const m = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, '');
    if (k) m.set(k, argv[i + 1] ?? '');
  }
  return { concurrency: Number(m.get('concurrency') ?? 200) };
}

const randId = () => Math.floor(Math.random() * config.keyspace);

// Pre-built batch of messages for kafka/redpanda produce requests.
const batch = Array.from({ length: config.brokerBatch }, () => ({ value: payload }));

// One operation. Returns the number of messages it covered (>1 for batched
// broker sends). Throws on failure so the worker loop can tag status=error.
async function operation(target: Target, op: Op): Promise<number> {
  // Brokers: one acked produce request carrying `brokerBatch` messages (acks=1).
  if (target === 'kafka') {
    await producer.send({ topic: config.kafka.topic, acks: 1, messages: batch });
    return batch.length;
  }
  if (target === 'redpanda') {
    await redpandaProducer.send({ topic: config.redpanda.topic, acks: 1, messages: batch });
    return batch.length;
  }
  if (target === 'rabbitmq') {
    await publishRabbit(payload);
    return 1;
  }

  const id = randId();
  if (target === 'pg') {
    await (op === 'write'
      ? pool.query(
          `INSERT INTO kv (id, v) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET v = EXCLUDED.v, ts = now()`,
          [id, `w-${Date.now()}`],
        )
      : pool.query('SELECT v FROM kv WHERE id = $1', [id]));
    return 1;
  }
  await (op === 'write' ? redis.set(redisKey(id), `w-${Date.now()}`) : redis.get(redisKey(id)));
  return 1;
}

// Drive one target/op at `concurrency` for `duration` seconds.
async function runPhase(
  target: Target,
  op: Op,
  concurrency: number,
  duration: number,
): Promise<void> {
  const deadline = Date.now() + duration * 1000;
  let count = 0;
  let errors = 0;

  // Each worker hammers the backend back-to-back until the deadline; N workers
  // = N in-flight ops. This measures throughput-at-saturation, not a fixed RPS.
  async function worker(): Promise<void> {
    while (Date.now() < deadline) {
      const labels: OpLabels = { target, op, status: 'ok' };
      const start = performance.now();
      let weight = 1;
      try {
        weight = await operation(target, op);
      } catch {
        labels.status = 'error';
        errors++;
      }
      record(labels, performance.now() - start, weight);
      count += weight;
    }
  }

  console.log(`running: target=${target} op=${op} concurrency=${concurrency} duration=${duration}s`);
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedS = (performance.now() - startedAt) / 1000;
  console.log(
    `  done: ${count} ops in ${elapsedS.toFixed(1)}s ` +
      `= ${(count / elapsedS).toFixed(0)} ops/s (${errors} errors)`,
  );
}

async function main(): Promise<void> {
  const { concurrency } = parseArgs(process.argv.slice(2));
  await Promise.all([ensureSchema(), connectKafka(), connectRedpanda(), connectRabbit()]);

  for (const { target, op } of PHASES) {
    await runPhase(target, op, concurrency, DURATION_S);
    // Idle gap so each phase's start and stop is clearly visible on the
    // graphs (RPS drops to zero between phases instead of running back-to-back).
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Flush metrics, then close connections.
  await shutdownTelemetry();
  await Promise.all([closePg(), closeRedis(), closeKafka(), closeRedpanda(), closeRabbit()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
