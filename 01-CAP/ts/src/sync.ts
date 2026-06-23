// Scenario 3 — synchronous replication under a partition = CP.
// Flip one knob: synchronous_standby_names='replica1'. Now a commit on the
// primary must be acknowledged by the standby before it returns. Cut the link
// and the next write BLOCKS — the primary refuses to lose consistency, so it
// sacrifices write availability. Heal the link and the blocked write completes.
import { primary, readReplica, sleep, closeAll } from './pg.js';
import { cut, heal } from './toxiproxy.js';

async function setSyncStandby(names: string): Promise<void> {
  await primary.query(`ALTER SYSTEM SET synchronous_standby_names = $1`, [names]);
  await primary.query(`SELECT pg_reload_conf()`);
}

async function main(): Promise<void> {
  await heal();
  await sleep(500);

  console.log('enabling synchronous replication (synchronous_standby_names=replica1) ...');
  await setSyncStandby('replica1');
  await sleep(500);
  const { rows } = await primary.query<{ sync_state: string }>(
    `SELECT sync_state FROM pg_stat_replication WHERE application_name='replica1'`,
  );
  console.log(`  standby sync_state = ${rows[0]?.sync_state ?? '(not connected)'}`);

  console.log('\n--- CUT replication link (partition) ---');
  await cut();
  await sleep(500);

  console.log('issuing a write to the primary (NOT awaited yet) ...');
  const t0 = Date.now();
  let done = false;
  const write = primary
    .query('UPDATE counter SET n = n + 1, ts = now() WHERE id = 1')
    .then(() => {
      done = true;
    });

  // Watch it block. A sync commit can't complete without the standby's ack.
  for (let i = 0; i < 4 && !done; i++) {
    await sleep(1000);
    console.log(`  ${Date.now() - t0}ms: write still BLOCKED (primary NOT available for writes)`);
  }

  console.log('\n--- HEAL link ---');
  await heal();
  await write;
  console.log(`  write completed after ${Date.now() - t0}ms, replica now ${await readReplica()}`);

  console.log(`\n=> synchronous replica chooses CONSISTENCY: writes stall rather than diverge.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Always restore async + heal so the stack is left usable.
    try {
      await heal();
      await setSyncStandby('');
    } catch {
      /* ignore */
    }
    await closeAll();
  });
