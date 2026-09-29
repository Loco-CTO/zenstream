#!/usr/bin/env bash
set -euo pipefail

image="${1:?Provide the image to smoke-test}"
container="zenstream-smoke-${ARCH:-local}-$$"
orchestrator_url="https://orchestrator.example.test:9443"
origin="$orchestrator_url"
docker run --detach --name "$container" --publish 127.0.0.1:9086:9086 \
	--env "ZENSTREAM_ORCHESTRATOR_URL=$orchestrator_url" "$image" >/dev/null
trap 'docker rm --force "$container" >/dev/null 2>&1 || true' EXIT

ready=false
for attempt in $(seq 1 60); do
	if curl --silent --fail http://127.0.0.1:9086/ --output "$RUNNER_TEMP/zenstream-page.html" 2>/dev/null; then
		ready=true
		break
	fi
	sleep 2
done
[[ "$ready" == true ]] || {
	docker logs "$container"
	echo "The web container did not serve its page." >&2
	exit 1
}

curl --silent --show-error --dump-header "$RUNNER_TEMP/zenstream-headers.txt" \
	http://127.0.0.1:9086/ --output "$RUNNER_TEMP/zenstream-page.html"
grep -Fq 'runtime-config.js' "$RUNNER_TEMP/zenstream-page.html"
grep -Fq "Content-Security-Policy:" "$RUNNER_TEMP/zenstream-headers.txt"
grep -Fq "img-src 'self' data: blob: $origin" "$RUNNER_TEMP/zenstream-headers.txt"
grep -Fq "media-src 'self' blob: $origin" "$RUNNER_TEMP/zenstream-headers.txt"
grep -Fq "connect-src 'self' $origin wss://orchestrator.example.test:9443" \
	"$RUNNER_TEMP/zenstream-headers.txt"
if grep -Eq '(^|[[:space:]])(https:|wss:)([[:space:];]|$)' "$RUNNER_TEMP/zenstream-headers.txt"; then
	echo "The runtime policy contains an unrestricted HTTPS or WebSocket source." >&2
	exit 1
fi

curl --silent --show-error --dump-header "$RUNNER_TEMP/zenstream-runtime-headers.txt" \
	http://127.0.0.1:9086/runtime-config.js --output "$RUNNER_TEMP/zenstream-runtime-config.js"
grep -Fq "orchestratorUrl: \"$orchestrator_url\"" "$RUNNER_TEMP/zenstream-runtime-config.js"
grep -Fqi "Cache-Control: no-store" "$RUNNER_TEMP/zenstream-runtime-headers.txt"

echo "Container page, exact runtime Orchestrator URL, and origin-scoped CSP passed for ${ARCH:-local}."
