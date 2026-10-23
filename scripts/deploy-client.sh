#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

die() { echo "ERROR: $*" >&2; exit 1; }
mode=${1:-}
image=${2:-}
config=${3:-/opt/chagok/client-deploy.conf}
[[ "$mode" == deploy || "$mode" == rollback ]] || die 'Use: deploy IMAGE CONFIG | rollback "" CONFIG'
[ -f "$config" ] || die "Deployment config not found: $config"

# This file is maintained by the server administrator and can define Bash arrays.
source "$config"
: "${COMPOSE_PROJECT_DIRECTORY:?Set COMPOSE_PROJECT_DIRECTORY}"
: "${COMPOSE_PROJECT_NAME:?Set COMPOSE_PROJECT_NAME}"
: "${DEPLOY_STATE_DIR:?Set DEPLOY_STATE_DIR}"
: "${SMOKE_BASE_URL:?Set SMOKE_BASE_URL}"
image_repository=${IMAGE_REPOSITORY:-ghcr.io/chagokai/client}
health_timeout=${HEALTH_TIMEOUT:-90}
http_attempts=${HTTP_ATTEMPTS:-6}
http_retry_delay=${HTTP_RETRY_DELAY:-2}
[[ "$health_timeout" =~ ^[1-9][0-9]*$ ]] || die 'Invalid HEALTH_TIMEOUT'
[[ "$http_attempts" =~ ^[1-9][0-9]*$ ]] || die 'Invalid HTTP_ATTEMPTS'
[[ "$http_retry_delay" =~ ^[0-9]+$ ]] || die 'Invalid HTTP_RETRY_DELAY'
[[ "$COMPOSE_PROJECT_DIRECTORY" = /* && "$DEPLOY_STATE_DIR" = /* ]] || die 'Use absolute server paths'
[ -d "$COMPOSE_PROJECT_DIRECTORY" ] || die 'Compose project directory does not exist'
[ "${#COMPOSE_FILES[@]}" -gt 0 ] || die 'Set COMPOSE_FILES to a Bash array of absolute Compose paths'
for command in docker curl python3 flock; do command -v "$command" >/dev/null || die "Missing $command"; done

mkdir -p "$DEPLOY_STATE_DIR"
exec 9> "$DEPLOY_STATE_DIR/deploy.lock"
flock -n 9 || die 'Another frontend deployment is already running'

compose=(docker compose --project-directory "$COMPOSE_PROJECT_DIRECTORY" --project-name "$COMPOSE_PROJECT_NAME")
if [ -n "${COMPOSE_ENV_FILE:-}" ]; then
  [ -f "$COMPOSE_ENV_FILE" ] || die 'Compose environment file does not exist'
  compose+=(--env-file "$COMPOSE_ENV_FILE")
fi
for file in "${COMPOSE_FILES[@]}"; do
  [[ "$file" = /* && -f "$file" ]] || die "Compose file must exist at an absolute path: $file"
  compose+=(-f "$file")
done
override="$DEPLOY_STATE_DIR/frontend.image.yaml"
active_compose=("${compose[@]}")
if [ -f "$override" ]; then active_compose+=(-f "$override"); fi
"${active_compose[@]}" config --quiet
container=$("${active_compose[@]}" ps --status running -q frontend)
[[ -n "$container" && "$container" != *$'\n'* ]] || die 'Expected exactly one running frontend; bootstrap the stack first'
old_image_id=$(docker inspect --format '{{.Image}}' "$container")
[[ "$old_image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || die 'Cannot determine current frontend image'
rollback_image="chagok-client-rollback:${old_image_id#sha256:}"

if [ "$mode" = rollback ]; then
  [ -f "$DEPLOY_STATE_DIR/previous-image" ] || die 'No previous successful deployment is recorded'
  image=$(cat "$DEPLOY_STATE_DIR/previous-image")
  [[ "$image" =~ ^chagok-client-rollback:[a-f0-9]{64}$ ]] || die 'Invalid recorded rollback image'
else
  prefix="$image_repository@sha256:"
  [[ "$image" = "$prefix"* ]] || die "Image must belong to $image_repository and use a digest"
  digest=${image#"$prefix"}
  [[ "$digest" =~ ^[a-f0-9]{64}$ ]] || die 'Expected a full sha256 image digest'
  # Pull before changing the running service or deployment state.
  docker pull "$image"
fi
next_image_id=$(docker image inspect --format '{{.Id}}' "$image")

check_http() {
  local base=${1%/}
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$base/healthz" | grep -qx ok || return 1
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$base/login" | grep -q 'id="app"' || return 1
  # A 200 SPA fallback must not count as a working backend connection.
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$base/api/v1/auth/csrf" |
    python3 -c 'import json, sys; d = json.load(sys.stdin)["data"]; sys.exit(0 if isinstance(d.get("token"), str) and d["token"] and isinstance(d.get("headerName"), str) and d["headerName"] else 1)'
}

smoke() {
  local attempt
  for ((attempt = 1; attempt <= http_attempts; attempt++)); do
    if check_http "$SMOKE_BASE_URL" && { [ -z "${PUBLIC_BASE_URL:-}" ] || check_http "$PUBLIC_BASE_URL"; }; then
      return 0
    fi
    if [ "$attempt" -lt "$http_attempts" ]; then sleep "$http_retry_delay"; fi
  done
  return 1
}

if [ "$next_image_id" = "$old_image_id" ]; then
  smoke || die 'The existing frontend failed its smoke checks'
  echo 'The requested image is already running; rollback history was preserved.'
  exit 0
fi

docker image tag "$old_image_id" "$rollback_image"
old_current_record=''
old_previous_record=''
if [ -f "$DEPLOY_STATE_DIR/current-image" ]; then old_current_record=$(cat "$DEPLOY_STATE_DIR/current-image"); fi
if [ -f "$DEPLOY_STATE_DIR/previous-image" ]; then old_previous_record=$(cat "$DEPLOY_STATE_DIR/previous-image"); fi
release_compose=("${compose[@]}" -f "$override")
write_image() {
  printf 'services:\n  frontend:\n    image: "%s"\n' "$1" > "$override.tmp"
  mv -- "$override.tmp" "$override"
}
start_frontend() {
  "${release_compose[@]}" up --detach --no-deps --no-build --pull never --wait --wait-timeout "$health_timeout" frontend
}
record() {
  printf '%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" >> "$DEPLOY_STATE_DIR/history.tsv"
}
restore_record() {
  if [ -n "$2" ]; then
    printf '%s\n' "$2" > "$DEPLOY_STATE_DIR/$1.tmp"
    mv -- "$DEPLOY_STATE_DIR/$1.tmp" "$DEPLOY_STATE_DIR/$1"
  else
    rm -f -- "$DEPLOY_STATE_DIR/$1"
  fi
}
restore_on_failure() {
  local status=$?
  trap - EXIT HUP INT TERM
  if [ "$status" -ne 0 ]; then
    set +e
    echo 'Deployment failed; restoring the exact previous frontend image.' >&2
    restore_record current-image "$old_current_record"
    restore_record previous-image "$old_previous_record"
    if write_image "$rollback_image" && start_frontend && smoke; then
      record restored "$rollback_image"
      echo 'Previous frontend restored. This deployment remains failed.' >&2
    else
      record rollback-failed "$rollback_image"
      echo 'ERROR: Automatic rollback failed; inspect the frontend and backend on the server.' >&2
    fi
  fi
  exit "$status"
}
trap restore_on_failure EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

write_image "$image"
start_frontend
smoke || die 'Frontend or API smoke checks failed'
printf '%s\n' "$rollback_image" > "$DEPLOY_STATE_DIR/previous-image.tmp"
printf '%s\n' "$image" > "$DEPLOY_STATE_DIR/current-image.tmp"
mv -- "$DEPLOY_STATE_DIR/previous-image.tmp" "$DEPLOY_STATE_DIR/previous-image"
mv -- "$DEPLOY_STATE_DIR/current-image.tmp" "$DEPLOY_STATE_DIR/current-image"
record "$mode" "$image"
trap - EXIT HUP INT TERM
echo "Frontend $mode succeeded: $image"
