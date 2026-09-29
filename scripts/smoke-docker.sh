#!/usr/bin/env bash
set -euo pipefail

project_name="zenstream-web-smoke-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
port="${ZENSTREAM_PORT:-19086}"
url="http://127.0.0.1:${port}/"

cleanup() {
  docker compose --project-name "$project_name" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

export NEXT_PUBLIC_ZSO_URL="${NEXT_PUBLIC_ZSO_URL:-http://127.0.0.1:9088}"
export ZENSTREAM_PORT="$port"

docker compose --project-name "$project_name" up --build --detach zenstream

deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  if response="$(curl --silent --show-error --connect-timeout 2 --max-time 4 --output /dev/null --write-out '%{http_code}' "$url" 2>/dev/null)" \
    && [[ "$response" =~ ^2[0-9][0-9]$ ]]; then
    echo "Web production container served / with HTTP $response."
    exit 0
  fi

  container_state="$(docker compose --project-name "$project_name" ps --format '{{.State}}' zenstream 2>/dev/null || true)"
  if [[ "$container_state" == "exited" || "$container_state" == "dead" ]]; then
    echo "Web production container stopped before becoming ready." >&2
    docker compose --project-name "$project_name" logs --no-color zenstream >&2 || true
    exit 1
  fi
  sleep 2
done

echo "Web production container did not serve / within 120 seconds." >&2
docker compose --project-name "$project_name" logs --no-color zenstream >&2 || true
exit 1
