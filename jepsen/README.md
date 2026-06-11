# Jepsen-style consistency testing

**Goal:** partition a datastore (one of mine, or a real one) under load and check
the history with a linearizability/serializability checker (Elle, Knossos).

**Teaches:** whether a system's *claimed* consistency actually holds — the gap
between the docs and reality.

**Plan**
- [ ] Pick a target (e.g. the `kv-store/` build, or etcd/Cassandra)
- [ ] Generate a concurrent workload + nemesis (partitions, clock skew)
- [ ] Record the history; check with Elle/Knossos
- [ ] Find (or fail to find) a violation; explain it
- [ ] Teach-back write-up → site

**Status:** 🔲 not started

Notes: [Distributed Systems → consistency models](https://zalizniak.com/system-design/distributed-systems/#consistency-models)
