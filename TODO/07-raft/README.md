# Raft from scratch (Go)

**Goal:** implement Raft — leader election, log replication, persistence — then
kill nodes and watch the cluster recover.

**Teaches:** consensus, quorums, why a replicated log + single leader is the
backbone of so many systems (etcd, KRaft, Postgres HA).

**Plan**
- [ ] Leader election (terms, votes, election timeout)
- [ ] Log replication (AppendEntries, commit index)
- [ ] Persistence + crash recovery
- [ ] Failure drills: kill the leader, partition the cluster, watch re-election
- [ ] Teach-back write-up → site

**Status:** 🔲 not started

Notes / teach-back: [Distributed Systems → consensus](https://zalizniak.com/system-design/distributed-systems/#consensus)
