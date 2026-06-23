#!/bin/sh
# Bring up primary + standby + toxiproxy and wait for the standby to be streaming.
set -e
cd "$(dirname "$0")"
docker compose up -d
echo "waiting for replica to start streaming ..."
until docker compose exec -T primary \
  psql -U admin -d dslab -tAc \
  "SELECT 1 FROM pg_stat_replication WHERE application_name='replica1'" \
  2>/dev/null | grep -q 1; do
  sleep 1
done
echo "replica streaming. ready."
