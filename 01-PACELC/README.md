# PACELC in practice: C vs A on a Postgres primary/standby

**Goal:** feel the consistency–availability trade-off on a real replicated
Postgres, by partitioning the replication link with Toxiproxy and watching how
async vs synchronous replication react.

**Teaches:** CAP is only interesting once data is replicated. Async streaming
replication is **AP** (replica stays up, serves stale data); flipping
`synchronous_standby_names` makes the same stack **CP** (writes block rather
than diverge). The everyday cost — staleness with no partition at all — is
PACELC's *Else-Latency* corner.

## Topology

```
 app writes ─► primary :5432 ──WAL──► toxiproxy ──► replica :5433 ◄─ app reads
                                       ▲
                                  cut here = partition (admin API :8474)
```

App traffic hits the two databases directly. Only the WAL stream crosses
Toxiproxy, so disabling that proxy models "primary and replica can't talk"
without touching client connectivity.

## Run

```bash
01-PACELC/docker/start.sh    # primary + standby + toxiproxy; waits for streaming
cd 01-PACELC/ts && pnpm install

pnpm timeline                # seeds the row, then walks every phase (~3.5 min)

cd ../.. && 01-PACELC/docker/stop.sh
```

`timeline` runs every corner back to back on a clock while exporting metrics —
async staleness (EL), async + partition (AP), then synchronous + partition (CP).

## Watch it on a dashboard

Open **http://localhost:3005** → dashboard *"PACELC — C vs A under partition"*.
The "Primary vs replica counter value" panel is the one to watch: under healthy
async the replica tracks the primary a few ms behind (a small steady gap — the
EL latency cost, from a 3ms link latency the timeline applies only for that
first phase), then flatlines the
instant you partition while the primary keeps climbing (= AP), snaps back on
heal, and finally *both* freeze under sync+partition as the primary's writes
block (= CP). The state panel marks each window.

**Status:** 🟡 scaffold; not yet run end-to-end.

Related: [`TODO/06-pg-replication/`](../TODO/06-pg-replication/) covers the
replication *mechanics* (lag, WAL, promotion, repair) by hand.
