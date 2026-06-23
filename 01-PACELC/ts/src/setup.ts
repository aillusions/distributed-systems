// Create the single tracked row the scenarios drive. Runs on the primary; the
// DDL + seed stream to the replica automatically.
import { primary, closeAll } from './pg.js';

async function main(): Promise<void> {
  await primary.query(`
    CREATE TABLE IF NOT EXISTS counter (
      id int PRIMARY KEY,
      n  bigint NOT NULL,
      ts timestamptz NOT NULL DEFAULT now()
    )
  `);
  await primary.query(`
    INSERT INTO counter (id, n) VALUES (1, 0)
    ON CONFLICT (id) DO UPDATE SET n = 0, ts = now()
  `);
  console.log('setup: counter row ready (n=0)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeAll);
