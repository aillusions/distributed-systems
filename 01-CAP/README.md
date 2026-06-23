# CAP in practice: C vs A on a Postgres primary/standby

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
./up.sh                 # primary + standby + toxiproxy; waits for streaming
cd ts && pnpm install && pnpm setup

pnpm lag                # async staleness, NO partition  (PACELC EL)
pnpm partition          # async + partition: replica stays up, stale  (AP)
pnpm sync               # synchronous + partition: writes block       (CP)

cd .. && ./down.sh
```

**Status:** 🟡 scaffold; not yet run end-to-end.

Related: [`TODO/06-pg-replication/`](../TODO/06-pg-replication/) covers the
replication *mechanics* (lag, WAL, promotion, repair) by hand.
