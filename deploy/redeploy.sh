#!/usr/bin/env bash
# ICDL With Mehrdad — pull the latest code into an already-bootstrapped server.
#
#   bash deploy/redeploy.sh
#
# Pulls the branch, backs up the SQLite database, reinstalls dependencies,
# syncs the schema, rebuilds and reloads pm2.

set -euo pipefail

APP_NAME="${APP_NAME:-icdl}"
APP_DIR="${APP_DIR:-/var/www/academyr.ir}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3000}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$APP_DIR" 2>/dev/null || die "$APP_DIR not found."
[[ -f .env ]] || die ".env missing in $APP_DIR"

log "Pulling $BRANCH"
git fetch --prune origin
git reset --hard "origin/$BRANCH"

log "Backing up the SQLite database"
db_url="$(grep -E '^DATABASE_URL=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
db_path="${db_url#file:}"
# `file:./prod.db` is resolved relative to the prisma/ directory.
[[ "$db_path" != /* ]] && db_path="prisma/${db_path#./}"
if [[ -f "$db_path" ]]; then
  mkdir -p prisma/backups
  cp "$db_path" "prisma/backups/prod-$(date +%Y%m%d-%H%M%S).db"
  ls -1t prisma/backups/*.db 2>/dev/null | tail -n +11 | xargs -r rm --
  echo "    saved: $db_path -> prisma/backups/"
else
  warn "Database file not found from DATABASE_URL ($db_url) — skipping backup"
fi

log "Installing dependencies"
npm ci

log "Syncing database schema"
npx prisma generate
# No --accept-data-loss on purpose: a destructive change must fail loudly.
if ! npx prisma db push --skip-generate; then
  die "prisma db push refused to run. Inspect 'npx prisma db push --dry-run' first."
fi

log "Building"
npm run build

log "Reloading pm2"
APP_DIR="$APP_DIR" PORT="$PORT" pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

log "Deployed"
pm2 status "$APP_NAME"
printf '\nHealth check: curl -sS -o /dev/null -w "%%{http_code}\\n" http://127.0.0.1:%s/\n' "$PORT"
