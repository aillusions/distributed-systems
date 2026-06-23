#!/bin/bash

# Pull every image without starting anything. Run from inside this directory.

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
docker compose pull
