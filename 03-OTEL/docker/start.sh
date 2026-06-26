#!/bin/bash

# Bring the OTEL stack up cleanly. Stops anything already running first so a
# stale container can't shadow the new stack, then starts detached.

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
./stop.sh
docker compose up -d

echo "Grafana:     http://localhost:3005"
echo "Prometheus:  http://localhost:9090/targets"
echo "Tempo API:   http://localhost:3200"
echo "Loki API:    http://localhost:3100"
echo ""
echo "Now run the app on the host (see ../ts/README.md):"
echo "  pnpm start:backend   # :3002"
echo "  pnpm start:gateway   # :3001"
echo "  pnpm load            # drives traffic through the gateway"
