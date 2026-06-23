# distributed-systems

Building, breaking, and verifying distributed systems to build fluency.
Companion code to the teach-back notes at
**[zalizniak.com/system-design/distributed-systems](https://zalizniak.com/system-design/distributed-systems/)**.

The method: **build it → break it → verify it → explain it.** One drill at a
time; each ends with a write-up on the site. This repo is the *code*; the site
is the *explanation*.

## Drills

| Drill | Folder | What it teaches | Status |
| --- | --- | --- | --- |
| CAP: C vs A | [`01-CAP/`](01-CAP/) | async=AP vs sync=CP under a partition (Toxiproxy) | 🟡 scaffold |

Queued in [`TODO/`](TODO/):

| Drill | Folder | What it teaches | Status |
| --- | --- | --- | --- |
| Raft from scratch (Go) | [`TODO/07-raft/`](TODO/07-raft/) | consensus, leader election, log replication | 🔲 not started |
| Replicated KV store | [`TODO/04-kv-store/`](TODO/04-kv-store/) | leader/follower, WAL, failover | 🔲 not started |
| Chaos drills | [`TODO/01-chaos/`](TODO/01-chaos/) | partial failure on your own stack | 🔲 not started |
| Operate a cluster & break it | [`TODO/02-cluster-break/`](TODO/02-cluster-break/) | quorum loss, re-election, rebalancing | 🔲 not started |
| Break Postgres replication | [`TODO/06-pg-replication/`](TODO/06-pg-replication/) | streaming repl, lag, promotion, repair | 🔲 not started |
| Reproduce a famous outage | [`TODO/05-outages/`](TODO/05-outages/) | recreate a postmortem in miniature | 🔲 not started |
| Jepsen consistency testing | [`TODO/03-jepsen/`](TODO/03-jepsen/) | do the claimed guarantees hold under partition | 🔲 not started |
| Model-check with TLA+ | [`TODO/08-tla/`](TODO/08-tla/) | verify the design before writing code | 🔲 not started |

Done elsewhere: the **MIT 6.824 / 6.5840 labs** (the course's own scaffold) and
the **teach-back write-ups** (on the site).

## Layout

Each folder is self-contained with its own `README.md` (goal, plan, status) and
build. Go is the default for the from-scratch drills (Raft, KV); the rest use
whatever fits (shell + `iptables`/Docker for chaos, Clojure for Jepsen, TLA+).