#!/bin/bash
# Bring up the 3-broker KRaft cluster + monitoring and wait until all three
# brokers report Running. Stops anything already running first so a stale
# container can't shadow the new stack.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"
./stop.sh
docker compose up -d

echo "waiting for all 3 brokers ..."
until [ "$(docker compose exec -T broker1 \
  /opt/kafka/bin/kafka-broker-api-versions.sh \
  --bootstrap-server broker1:9092 2>/dev/null | grep -c '(id:')" = 3 ]; do
  sleep 1
done
echo "cluster up: 3 brokers ready."

echo
echo "Grafana:     http://localhost:3006"
echo "Kafka UI:    http://localhost:8089   (topics / offsets / groups)"
echo "Console:     http://localhost:8088   (redpanda console, same data)"
echo "Prometheus:  http://localhost:9091/targets"
echo "Toxiproxy:   http://localhost:8475   (admin API)"
echo "Brokers:     localhost:19092  localhost:29092  localhost:39092"
