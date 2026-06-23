#!/bin/bash
# Bring up primary + standby + toxiproxy and wait for the standby to be
# streaming. Stops anything already running first so a stale container can't
# shadow the new stack.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
./stop.sh
docker compose up -d

echo "waiting for replica to start streaming ..."
until docker compose exec -T primary \
  psql -U admin -d dslab -tAc \
  "SELECT 1 FROM pg_stat_replication WHERE application_name='replica1'" \
  2>/dev/null | grep -q 1; do
  sleep 1
done
echo "replica streaming. ready."
echo "(pnpm seed adds a steady 3ms replication latency.)"

echo
echo "Grafana:     http://localhost:3005   (dashboard: PACELC — C vs A under partition)"
echo "Prometheus:  http://localhost:9090/targets"
echo "Toxiproxy:   http://localhost:8474    (admin API)"
echo "Postgres:    primary :5432 (writes)  replica :5433 (reads)"
