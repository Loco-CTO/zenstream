#!/bin/sh
set -eu

if [ -z "${ZENSTREAM_ORCHESTRATOR_URL:-}" ]; then
  echo "ZENSTREAM_ORCHESTRATOR_URL must be set at container startup." >&2
  exit 1
fi

node -e '
  const value = process.env.ZENSTREAM_ORCHESTRATOR_URL;
  let url;
  try { url = new URL(value); } catch { throw new Error("ZENSTREAM_ORCHESTRATOR_URL must be an absolute HTTP(S) URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("ZENSTREAM_ORCHESTRATOR_URL must use HTTP(S) and cannot include credentials, a query, or a fragment.");
  }
'

exec "$@"
