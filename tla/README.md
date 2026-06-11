# Model-check protocols with TLA+

**Goal:** spec a protocol (a commit protocol, a lock, my Raft) in TLA+/PlusCal
and let TLC find the interleaving I'd never hit by hand.

**Teaches:** verifying the *design* before writing code — the formal complement
to building and breaking.

**Plan**
- [ ] A first small spec (e.g. a mutex / single-decree consensus)
- [ ] Invariants + a liveness property; run TLC
- [ ] Spec the `raft/` design and check safety (one leader per term, log match)
- [ ] Teach-back write-up → site

(Deterministic simulation testing — à la FoundationDB/TigerBeetle — is the
runtime cousin; a candidate for a future folder.)

**Status:** 🔲 not started

Notes: [Distributed Systems → building fluency](https://zalizniak.com/system-design/distributed-systems/#building-fluency)
