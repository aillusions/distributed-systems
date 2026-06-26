// pg pool + redis client used by the backend. Both are auto-instrumented, so
// every query/command shows up as a child span under the request trace.
import { Pool } from 'pg';
import Redis from 'ioredis';
import { config } from './config';

export const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
  max: 10,
});

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
});

// SKUs the client picks from. Stock is seeded high so the demo runs on the
// happy/slow/declined paths rather than constantly going out of stock.
export const SKUS = Array.from({ length: 10 }, (_, i) => `sku-${i}`);

export async function initSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id         BIGSERIAL PRIMARY KEY,
      sku        TEXT NOT NULL,
      qty        INT  NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await Promise.all(SKUS.map((sku) => redis.set(`stock:${sku}`, 1_000_000)));
}
