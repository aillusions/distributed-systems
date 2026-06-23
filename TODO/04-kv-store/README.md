# Replicated KV store

**Goal:** a leader/follower key-value store with a write-ahead log, then add
failover. A mini-Aurora.

**Teaches:** replication, WAL durability, read/write paths, and *feeling* every
consistency choice as a line of code.

**Plan**
- [ ] Single-node KV with a WAL + recovery
- [ ] Leader/follower replication
- [ ] Reads from replicas (and the staleness that follows)
- [ ] Failover: promote a follower when the leader dies
- [ ] Teach-back write-up → site

**Status:** 🔲 not started

Notes / teach-back: [Distributed Systems → replication & partitioning](https://zalizniak.com/system-design/distributed-systems/#replication--partitioning)
