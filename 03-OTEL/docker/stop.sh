#!/bin/bash

# Tear down the stack (removes containers + the default network). No named
# volumes; Tempo/Loki use ephemeral container storage. Extra args pass through.

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose down "$@"
