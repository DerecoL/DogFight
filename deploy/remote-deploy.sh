#!/usr/bin/env bash
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${EXPECTED_JS:?EXPECTED_JS is required}"
: "${EXPECTED_CSS:?EXPECTED_CSS is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"

TEMP_DEPLOY_PATH="${DEPLOY_PATH}.repo-tmp"

if [ -z "${REMOTE_PACKAGE:-}" ] && [ -z "${SOURCE_PATH:-}" ]; then
  echo "REMOTE_PACKAGE or SOURCE_PATH is required"
  exit 1
fi

if [ -z "${REMOTE_ENV_FILE:-}" ] && [ -z "${PRODUCTION_ENV_B64:-}" ]; then
  echo "REMOTE_ENV_FILE or PRODUCTION_ENV_B64 is required"
  exit 1
fi

mkdir -p "$DEPLOY_PATH"
rm -rf "$TEMP_DEPLOY_PATH"
mkdir -p "$TEMP_DEPLOY_PATH"
if [ -n "${SOURCE_PATH:-}" ]; then
  cp -a "$SOURCE_PATH"/. "$TEMP_DEPLOY_PATH"/
else
  tar -xzf "$REMOTE_PACKAGE" -C "$TEMP_DEPLOY_PATH"
fi
rm -rf \
  "$TEMP_DEPLOY_PATH/.git" \
  "$TEMP_DEPLOY_PATH/dist" \
  "$TEMP_DEPLOY_PATH/dist-click" \
  "$TEMP_DEPLOY_PATH/.superpowers" \
  "$TEMP_DEPLOY_PATH/docs/superpowers" \
  "$TEMP_DEPLOY_PATH/picture"

if [ -n "${PRODUCTION_ENV_B64:-}" ]; then
  printf '%s' "$PRODUCTION_ENV_B64" | base64 -d > "$TEMP_DEPLOY_PATH/.env.production"
else
  cp "$REMOTE_ENV_FILE" "$TEMP_DEPLOY_PATH/.env.production"
fi

if ! grep -q '^DATABASE_URL=' "$TEMP_DEPLOY_PATH/.env.production"; then
  echo "PRODUCTION_ENV must include DATABASE_URL"
  exit 1
fi

cd "$TEMP_DEPLOY_PATH"
docker compose --env-file .env.production config >/dev/null

if [ -f "$DEPLOY_PATH/deploy/backup-postgres.sh" ] && [ -f "$DEPLOY_PATH/.env.production" ]; then
  cd "$DEPLOY_PATH"
  export BACKUP_DIR="$DEPLOY_PATH/backups"
  BACKUP_REASON=predeploy sh deploy/backup-postgres.sh
else
  echo "Skipping predeploy backup because the existing deployment is not initialized yet."
fi

find "$DEPLOY_PATH" -mindepth 1 -maxdepth 1 ! -name backups ! -name .env.production -exec rm -rf {} +
cp -a "$TEMP_DEPLOY_PATH"/. "$DEPLOY_PATH"/
rm -rf "$TEMP_DEPLOY_PATH"
if [ -n "${REMOTE_PACKAGE:-}" ]; then
  rm -f "$REMOTE_PACKAGE"
fi
if [ -n "${REMOTE_ENV_FILE:-}" ]; then
  rm -f "$REMOTE_ENV_FILE"
fi
if [ -n "${REMOTE_SCRIPT:-}" ]; then
  rm -f "$REMOTE_SCRIPT"
fi

cd "$DEPLOY_PATH"
docker compose build --no-cache api caddy
docker compose up -d --build --remove-orphans
docker compose up -d --build --force-recreate --no-deps caddy
docker compose ps

api_healthy=0
for attempt in $(seq 1 30); do
  if docker compose exec -T api node --input-type=module -e "const response = await fetch('http://127.0.0.1:4000/api/health'); const body = await response.json().catch(() => null); if (!response.ok || !body || body.database !== 'ok') { console.error(JSON.stringify(body)); process.exit(1); } console.log(JSON.stringify(body));"; then
    api_healthy=1
    break
  fi
  echo "API health check attempt $attempt failed; waiting..."
  sleep 2
done

if [ "$api_healthy" -ne 1 ]; then
  docker compose logs --tail=200 api caddy
  exit 1
fi

frontend_index="$(docker compose exec -T caddy cat /srv/index.html)"
js_asset="$(printf '%s\n' "$frontend_index" | sed -n 's/.*src="\/\(assets\/index-[^"]*\.js\)".*/\1/p' | head -n 1)"
css_asset="$(printf '%s\n' "$frontend_index" | sed -n 's/.*href="\/\(assets\/index-[^"]*\.css\)".*/\1/p' | head -n 1)"

if [ -z "$js_asset" ] || [ -z "$css_asset" ]; then
  echo "Could not derive public frontend verification inputs."
  printf '%s\n' "$frontend_index"
  docker compose logs --tail=200 api caddy
  exit 1
fi

if [ "$js_asset" != "$EXPECTED_JS" ] || [ "$css_asset" != "$EXPECTED_CSS" ]; then
  echo "Caddy image does not match expected frontend assets."
  echo "Expected: $EXPECTED_JS / $EXPECTED_CSS"
  echo "Actual:   $js_asset / $css_asset"
  printf '%s\n' "$frontend_index"
  docker compose logs --tail=200 api caddy
  exit 1
fi

echo "Caddy image contains $js_asset and $css_asset"
for attempt in $(seq 1 30); do
  public_index="$(curl -fsSL -H 'Cache-Control: no-cache' "https://www.torcharena.online/?deploy=${GITHUB_SHA}-${attempt}" || true)"
  if printf '%s\n' "$public_index" | grep -Fq "$js_asset" && printf '%s\n' "$public_index" | grep -Fq "$css_asset"; then
    echo "Public frontend switched to $js_asset and $css_asset"
    exit 0
  fi
  echo "Public frontend still has not switched to $js_asset / $css_asset; waiting..."
  sleep 2
done

docker compose logs --tail=200 api caddy
exit 1
