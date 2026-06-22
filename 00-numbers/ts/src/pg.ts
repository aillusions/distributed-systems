import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool(config.pg);

// `kv` is the table both the seeder and the load generator hit.
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv (
      id  bigint PRIMARY KEY,
      v   text NOT NULL,
      ts  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function closePg(): Promise<void> {
  await pool.end();
}
