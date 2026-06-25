// Pre-populate Postgres and Redis with `config.keyspace` rows/keys so that
// read load has something to hit. Idempotent-ish: upserts pg rows, overwrites
// redis keys. Run once before driving read load:
//
//   pnpm seed

import { config } from './config.js';
import { ensureSchema, pool, closePg } from './pg.js';
import { redis, redisKey, closeRedis } from './redis.js';

const N = config.keyspace;
const BATCH = 1000;

async function seedPg(): Promise<void> {
  await ensureSchema();
  for (let start = 0; start < N; start += BATCH) {
    const end = Math.min(start + BATCH, N);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (let id = start; id < end; id++) {
      values.push(`($${p++}, $${p++})`);
      params.push(id, `seed-${id}`);
    }
    await pool.query(
      `INSERT INTO kv (id, v) VALUES ${values.join(',')}
       ON CONFLICT (id) DO NOTHING`,
      params,
    );
  }
  console.log(`pg: seeded ${N} rows into kv`);
}

async function seedRedis(): Promise<void> {
  for (let start = 0; start < N; start += BATCH) {
    const end = Math.min(start + BATCH, N);
    const pipe = redis.pipeline();
    for (let id = start; id < end; id++) {
      pipe.set(redisKey(id), `seed-${id}`);
    }
    await pipe.exec();
  }
  console.log(`redis: seeded ${N} keys`);
}

async function main(): Promise<void> {
  await Promise.all([seedPg(), seedRedis()]);
  await Promise.all([closePg(), closeRedis()]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
