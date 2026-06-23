// Scripted PACELC timeline for the Grafana dashboard (http://localhost:3005,
// "PACELC — C vs A under partition"). Each experiment drives its OWN write/read
// traffic and sets its own link conditions, so the writes you see on the graph
// are issued right inside that experiment's block — no shared background loop.
//
// Phases (~3.5min total): three experiments, 30s each phase, 10s pause between.
//   EL (async healthy) → AP (async cut → heal) → CP (sync cut → heal)
import { primary, readReplica, lagBytes, sleep, closeAll } from './pg.js';
import { setEnabled, setLatency, clearToxics } from './toxiproxy.js';
import { state, recordWrite, shutdownTelemetry } from './telemetry.js';

let n = 0; // monotonic value written to the primary
let lastErr = ''; // de-dupe the tick error log

const stamp = () => new Date().toISOString().slice(11, 19);

// Create + reset the tracked row. The tmpfs DB is wiped on every start.sh, so
// the timeline seeds itself rather than depending on a separate `pnpm seed`.
async function ensureCounter(): Promise<void> {
  await primary.query(`
    CREATE TABLE IF NOT EXISTS counter (
      id int PRIMARY KEY,
      n  bigint NOT NULL,
      ts timestamptz NOT NULL DEFAULT now()
    )
  `);
  await primary.query(
    `INSERT INTO counter (id, n) VALUES (1, 0)
       ON CONFLICT (id) DO UPDATE SET n = 0, ts = now()`,
  );
}

const WRITE_MS = 10; // default gap between writes (~100/s); raise per-call for less load
const SAMPLE_MS = 100; // how often to read the replica / poll the standby

// Hammer writes for `secs` as fast as the round-trip allows (no inter-write
// sleep), so the WAL stream is under real pressure. primaryN advances on every
// commit; the replica value and standby state are sampled ~10x/s (those are
// extra round-trips, so we don't do them on every single write). If async
// replication can't keep up, replicaN visibly trails primaryN — natural lag,
// no artificial latency. Logs the phase label; keeps going if a write errors.
async function drive(label: string, secs: number, writeMs: number = WRITE_MS): Promise<void> {
  console.log(`\n[${stamp()}] ${label}  (${secs}s)`);
  const end = Date.now() + secs * 1000;
  let nextSample = 0;
  while (Date.now() < end) {
    n += 1;
    const t0 = Date.now();
    try {
      await primary.query('UPDATE counter SET n = $1, ts = now() WHERE id = 1', [n]);
      recordWrite(Date.now() - t0);
      state.primaryN = n;
      if (t0 >= nextSample) {
        nextSample = t0 + SAMPLE_MS;
        state.replicaN = await readReplica();
        state.standbyConnected = (await lagBytes()) == null ? 0 : 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== lastErr) {
        lastErr = msg;
        console.error(`write error: ${msg}`);
      }
    }
    await sleep(writeMs);
  }
}

// Drain the lag to zero. We keep writing but SLOWLY (every 200ms) so the replica
// easily keeps up — and, crucially, so WAL keeps flowing: an idle primary can
// otherwise leave the standby one record behind forever. Done once the gap has
// held at 0 for ~2s, so the 1s gauge export actually captures gap=0 on the graph.
async function converge(label: string, timeoutMs = 30_000): Promise<void> {
  console.log(`\n[${stamp()}] ${label}`);
  const end = Date.now() + timeoutMs;
  let zeroStreak = 0;
  while (Date.now() < end) {
    n += 1;
    try {
      await primary.query('UPDATE counter SET n = $1, ts = now() WHERE id = 1', [n]);
      state.primaryN = n;
      state.replicaN = await readReplica();
      state.standbyConnected = (await lagBytes()) == null ? 0 : 1;
    } catch {
      /* ignore */
    }
    if (state.primaryN - state.replicaN <= 0) {
      if (++zeroStreak >= 10) {
        console.log(`  converged at n=${state.primaryN}`);
        return;
      }
    } else {
      zeroStreak = 0;
    }
    await sleep(200);
  }
  console.log('  converge timed out');
}

async function setSync(names: string): Promise<void> {
  // ALTER SYSTEM rejects bind params; names is controlled, quote-escape anyway.
  const quoted = `'${names.replace(/'/g, "''")}'`;
  await primary.query(`ALTER SYSTEM SET synchronous_standby_names = ${quoted}`);
  await primary.query('SELECT pg_reload_conf()');
}

// Quiet gap between experiments: link is healthy, no traffic, metrics tagged
// 'pause' so the held values don't land in any experiment's panel.
async function pause(secs: number): Promise<void> {
  state.experiment = 'pause';
  console.log(`\n[${stamp()}] — pause —  (${secs}s)`);
  await sleep(secs * 1000);
}

async function main(): Promise<void> {
  // Baseline: healthy async link, seeded counter row.
  await setEnabled(true);
  await setSync('');
  await ensureCounter();
  state.partitioned = 0;
  state.syncMode = 0;
  state.standbyConnected = 1;
  await sleep(500);

  // Experiment 1 — PACELC "EL": async, healthy network. A 1s link latency keeps
  // the replica a few versions behind the primary — continuous staleness with
  // no partition at all.
  {
    state.experiment = '1-el';
    // await setLatency(1000); // artificial link delay — off; rely on write volume
    // ~50 writes/s (20ms): load high enough that the replica falls behind.
    await drive('ASYNC writes — does the replica lag under load?', 30, 20);
    // Keep reading (no more writes) until the replica catches up — the phase
    // ends only at total consistency, so the lag line drains to 0 on the graph.
    await converge('ASYNC drain — replica converges to the primary');
    await clearToxics(); // clean link for the partition experiments
  }

  await pause(10);

  // Experiment 2 — CAP "AP": async + partition. Writes still commit locally (no
  // standby to wait for), so the primary climbs while the cut-off replica freezes
  // — both stay up. Heal and the replica catches up (eventual consistency).
  {
    state.experiment = '2-ap';
    await setEnabled(false);
    state.partitioned = 1;
    await drive('ASYNC, CUT — AP: replica stale but both stay up', 30, 20);

    await setEnabled(true);
    state.partitioned = 0;
    await drive('ASYNC, HEAL — eventual consistency: replica converges', 30, 20);
  }

  await pause(10);

  // Experiment 3 — CAP "CP": synchronous. Each commit must be acked by the
  // standby, so a cut makes the next write BLOCK rather than diverge — the
  // primary gives up write availability.
  {
    state.experiment = '3-cp';
    await setSync('replica1');
    state.syncMode = 1;
    await drive('SYNC enabled — commits now wait for the standby ack', 30);

    // Cut: the next commit can't get its ack, so it hangs for the whole
    // partition. Issue it WITHOUT awaiting so we can watch primaryN stay frozen,
    // then heal and let it complete.
    await setEnabled(false);
    state.partitioned = 1;
    state.standbyConnected = 0;
    console.log(`\n[${stamp()}] SYNC, CUT — CP: write BLOCKS (primary unavailable)  (30s)`);
    n += 1;
    const t0 = Date.now();
    state.blockedSince = t0; // the write is now in flight; the gauge climbs from here
    const blocked = primary
      .query('UPDATE counter SET n = $1, ts = now() WHERE id = 1', [n])
      .then(() => {
        recordWrite(Date.now() - t0);
        state.primaryN = n; // only advances once the ack finally arrives
      })
      .catch((err) => console.error(`blocked write error: ${err}`))
      .finally(() => {
        state.blockedSince = null; // write returned — gauge back to 0
      });
    await sleep(30_000); // primaryN stays put — the commit hasn't returned

    await setEnabled(true);
    state.partitioned = 0;
    await blocked; // standby reconnects + acks, the commit returns
    await drive('SYNC, HEAL — blocked write completed, writes flow again', 30);
  }

  // Wind down: restore async, flush metrics.
  await setSync('');
  state.syncMode = 0;
  await sleep(500);
  await shutdownTelemetry();
  await closeAll();
  console.log('\ntimeline done. dashboard: http://localhost:3005');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await setEnabled(true);
    await setSync('');
  } catch {
    /* ignore */
  }
  await shutdownTelemetry();
  await closeAll();
  process.exitCode = 1;
});
