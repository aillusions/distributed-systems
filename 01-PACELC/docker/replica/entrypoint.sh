#!/bin/sh
# Stand up a streaming standby. On first boot (empty data dir) clone the primary
# with pg_basebackup THROUGH toxiproxy, so primary_conninfo points at the proxy
# and the WAL stream is partitionable. application_name=replica1 lets the primary
# name us in synchronous_standby_names.
set -e

PGDATA=/var/lib/postgresql/data/pgdata
CONNINFO="host=$PRIMARY_HOST port=$PRIMARY_PORT user=$PGUSER application_name=replica1"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "replica: waiting for primary via $PRIMARY_HOST:$PRIMARY_PORT ..."
  until pg_isready -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$PGUSER"; do sleep 1; done

  echo "replica: base backup from primary ..."
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"
  chmod 0700 "$PGDATA"
  pg_basebackup -d "$CONNINFO" -D "$PGDATA" -Fp -Xs -P -R
fi

exec postgres -D "$PGDATA" -c hot_standby=on
