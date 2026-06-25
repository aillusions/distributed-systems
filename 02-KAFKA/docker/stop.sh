#!/bin/bash
# Tear down the stack (containers + network + volumes). Brokers keep their log
# dirs in anonymous volumes; -v wipes them so each run starts clean.
# Extra args are passed through to `docker compose down`.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose down -v "$@"
