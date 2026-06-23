# Chaos drills

**Goal:** one failure scenario a day against a small staging stack — make
partial failure stop being theoretical.

**Teaches:** how real systems behave (and misbehave) under partial failure.

**Scenarios**
- [ ] Kill the primary
- [ ] Fill a disk
- [ ] PITR restore
- [ ] Partition the network with `iptables`
- [ ] (add as you go)

Each scenario: a script to induce it, notes on what broke and how it recovered,
then a teach-back write-up → site.

**Status:** 🔲 not started

Notes: [Distributed Systems → coordination & failure](https://zalizniak.com/system-design/distributed-systems/#coordination--failure)
