// Scenario 2 — async replication under a partition = AP.
// Cut the replication link. The primary keeps accepting writes (available) and
// the replica keeps serving reads (available) — but the replica's data is
// frozen and falls arbitrarily far behind. Consistency is given up; the system
// stays up. On heal, the replica converges (eventual consistency).
import { primary, readReplica, lagBytes, sleep, closeAll } from './pg.js';
import { cut, heal } from './toxiproxy.js';

async function bumpPrimary(n: number): Promise<void> {
  await primary.query('UPDATE counter SET n = $1, ts = now() WHERE id = 1', [n]);
}

async function waitReplica(target: number, timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await readReplica()) === target) return true;
    await sleep(50);
  }
  return false;
}

async function main(): Promise<void> {
  await heal();
  await bumpPrimary(1);
  await waitReplica(1);
  console.log(`baseline: primary=1, replica=${await readReplica()}, lag=${await lagBytes()} bytes`);

  console.log('\n--- CUT replication link (partition) ---');
  await cut();
  await sleep(500);

  for (let n = 2; n <= 6; n++) {
    const t0 = Date.now();
    await bumpPrimary(n);
    console.log(
      `  wrote n=${n} to primary in ${Date.now() - t0}ms (primary AVAILABLE), ` +
        `replica still serves ${await readReplica()}, lag=${await lagBytes()} (null = standby gone)`,
    );
  }

  console.log('\n--- HEAL link ---');
  await heal();
  const converged = await waitReplica(6);
  console.log(
    converged
      ? `  replica converged to ${await readReplica()} (eventual consistency)`
      : `  replica did NOT converge within timeout`,
  );

  console.log(`\n=> async replica chooses AVAILABILITY: serves stale data through the partition.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await heal();
    await closeAll();
  });
