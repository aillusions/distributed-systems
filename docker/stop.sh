#!/bin/bash

# Tear down the local dev stack (removes containers + the default network).
# There are no named volumes; postgres is tmpfs, so DB state is already
# ephemeral. Extra args are passed through to `docker compose down`.

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose down "$@"
