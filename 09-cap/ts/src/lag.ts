// Scenario 1 — staleness with NO partition (PACELC's "EL": Else, Latency).
// Async replication trades consistency for latency even when the network is
// perfectly healthy. Write to the primary, immediately read the replica, and
// count how often the replica hasn't caught up yet.
import { primary, replica, readReplica, lagBytes, closeAll } from './pg.js';
import { heal } from './toxiproxy.js';

const ITERS = 300;

async function main(): Promise<void> {
  await heal(); // make sure we're not still partitioned from a prior run

  let stale = 0;
  let maxLag = 0;
  for (let i = 1; i <= ITERS; i++) {
    await primary.query('UPDATE counter SET n = $1, ts = now() WHERE id = 1', [i]);
    const seen = await readReplica(); // read-your-write attempt against the replica
    if (seen !== i) stale++;
    const lag = (await lagBytes()) ?? 0;
    if (lag > maxLag) maxLag = lag;
  }

  console.log(`\nhealthy network, async replication:`);
  console.log(`  ${stale}/${ITERS} replica reads were STALE (did not see the write just made)`);
  console.log(`  peak replication lag: ${maxLag} bytes`);
  console.log(`\n=> consistency is sacrificed for latency with zero partition (PACELC EL).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeAll);
