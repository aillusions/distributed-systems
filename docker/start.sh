#!/bin/bash

# Bring the whole dev stack up cleanly (postgres/redis + monitoring).
# Stops anything already running so a stale container can't shadow the new
# stack, then starts detached.

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
./stop.sh
docker compose up -d

echo "Grafana:     http://localhost:3005"
echo "Prometheus:  http://localhost:9090/targets"
