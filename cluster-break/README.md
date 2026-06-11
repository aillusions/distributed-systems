# Operate a real cluster & break it

**Goal:** run a real distributed datastore (CockroachDB / Cassandra / etcd) as a
multi-node cluster, then kill nodes and watch what happens.

**Teaches:** quorum loss, leader re-election, and rebalancing — consensus and
quorum behavior *without* building it yourself. Cheaper than #raft/#kv, and you
see production-grade behavior.

**Plan**
- [ ] Stand up a 3–5 node cluster (docker-compose or VMs)
- [ ] Kill a minority → still available; observe
- [ ] Kill a majority → quorum lost; observe
- [ ] Add/remove a node → watch rebalancing
- [ ] Teach-back write-up → site

**Status:** 🔲 not started

Notes: [Distributed Systems → consensus](https://zalizniak.com/system-design/distributed-systems/#consensus)
