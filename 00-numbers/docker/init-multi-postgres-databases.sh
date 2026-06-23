#!/bin/bash

# Runs once on first container init (when /var/lib/postgresql/data is empty).
# If POSTGRES_MULTIPLE_DATABASES is set (comma-separated, optionally quoted),
# each entry becomes a database with a same-named owning user, and gets
# pg_stat_statements enabled.

set -e
set -u

function create_user_and_database() {
    local database=$1

    echo "  Creating user and database '$database'"

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE USER "$database";
        CREATE DATABASE "$database";
        GRANT ALL PRIVILEGES ON DATABASE "$database" TO "$database";
EOSQL

    echo "  Enabling pg_stat_statements on '$database'"

    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<-EOSQL
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"

    DBS=$(echo "$POSTGRES_MULTIPLE_DATABASES" | tr -d '"')

    for db in $(echo "$DBS" | tr ',' ' '); do
        create_user_and_database "$db"
    done

    echo "Multiple databases created"
fi
