#!/bin/bash
# Tear down the stack (containers + network + the tmpfs-backed volumes).
# Extra args are passed through to `docker compose down`.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose down -v "$@"
