import pg from 'pg';
import { config } from './config.js';

export const primary = new pg.Pool(config.primary);
export const replica = new pg.Pool(config.replica);

// Bytes the standby's replayed position trails the primary's current WAL.
// null => no standby is connected (i.e. we're partitioned).
export async function lagBytes(): Promise<number | null> {
  const { rows } = await primary.query<{ lag: string }>(
    `SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)::text AS lag
       FROM pg_stat_replication
      WHERE application_name = 'replica1'`,
  );
  return rows[0] ? Number(rows[0].lag) : null;
}

// Value the replica currently serves for the tracked counter row.
export async function readReplica(): Promise<number> {
  const { rows } = await replica.query<{ n: string }>(
    'SELECT n FROM counter WHERE id = 1',
  );
  return Number(rows[0]?.n ?? -1);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function closeAll(): Promise<void> {
  await Promise.allSettled([primary.end(), replica.end()]);
}
