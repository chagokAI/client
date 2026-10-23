#!/usr/bin/env bash
set -Eeuo pipefail

image=${1:?Usage: bash scripts/check-container.sh IMAGE}
name="chagok-client-check-${RANDOM}-$$"
work_dir=$(mktemp -d)

cleanup() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then docker logs "$name" >&2 || true; fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf -- "$work_dir"
  exit "$status"
}
trap cleanup EXIT

docker run --detach --name "$name" --publish 127.0.0.1::80 "$image" >/dev/null
docker exec "$name" nginx -t

deadline=$((SECONDS + 90))
while [ "$(docker inspect --format '{{.State.Health.Status}}' "$name")" != healthy ]; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo 'Container did not become healthy within 90 seconds.' >&2
    exit 1
  fi
  sleep 2
done

port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "80/tcp") 0).HostPort}}' "$name")
base_url="http://127.0.0.1:$port"
curl --fail --silent --show-error --max-time 10 "$base_url/healthz" | grep -qx ok
curl --fail --silent --show-error --max-time 10 "$base_url/login" > "$work_dir/index.html"
grep -q 'id="app"' "$work_dir/index.html"
asset=$(python3 -c 'import re, sys; print(re.search(r"src=\"(/assets/[^\"]+\.js)\"", open(sys.argv[1]).read())[1])' "$work_dir/index.html")
curl --fail --silent --show-error --max-time 10 "$base_url$asset" > "$work_dir/asset.js"
test -s "$work_dir/asset.js"
if head -c 100 "$work_dir/asset.js" | grep -qi '<!doctype html'; then
  echo 'JavaScript asset returned the SPA fallback.' >&2
  exit 1
fi
echo 'Container health, SPA route and JavaScript asset checks passed.'
