#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Prevent local Studio, mail and database ports from being exposed on the LAN.
if ! docker network inspect ifosse-local >/dev/null 2>&1; then
  docker network create -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 ifosse-local >/dev/null
fi
if [[ $(docker network inspect -f '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}' ifosse-local) != 127.0.0.1 ]]; then
  echo 'The existing ifosse-local network must bind ports to 127.0.0.1.' >&2
  exit 1
fi
supabase start --network-id ifosse-local
