#!/bin/bash
# Allow replication connections from anywhere (lab only). HOST_AUTH_METHOD=trust
# already opened `host all all all`, but the `replication` pseudo-db needs its
# own line. Reload so it applies without a restart.
set -e
echo 'host replication all all trust' >> "$PGDATA/pg_hba.conf"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c 'SELECT pg_reload_conf();'
