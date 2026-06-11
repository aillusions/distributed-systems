# Break Postgres replication by hand

**Goal:** stand up streaming replication on 2–3 boxes with **no operator**, then
induce lag, drop WAL segments, promote the wrong node, and repair.

**Teaches:** WAL-based streaming replication, replication lag, failover and the
ways it goes wrong — the mechanics under any managed Postgres.

**Plan**
- [ ] Primary + 1–2 standbys, streaming replication by hand
- [ ] Induce and measure replication lag
- [ ] Drop/age out WAL segments → break a standby → repair it
- [ ] Promote a standby; deliberately promote the *wrong* one; recover
- [ ] Teach-back write-up → site

**Status:** 🔲 not started

Notes: [Postgres → Scaling Postgres](https://zalizniak.com/system-design/postgres-internals/#scaling-postgres)
