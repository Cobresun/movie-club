#!/usr/bin/env bash
#
# Brings up a self-contained backend for `netlify dev`: a single-node
# CockroachDB in Docker, migrated from scratch, and a local stand-in for Resend
# (scripts/local/mailbox.ts). Nothing here talks to the shared CockroachDB Cloud
# cluster. Safe to re-run; each step skips what is already up.
#
# Writes .env only when there is none or it wrote the existing one, so a
# developer's own .env (the shared dev one from Notion) is never overwritten.
# Then run `netlify dev`, and `npm run local:seed` once it is serving.

set -euo pipefail
cd "$(dirname "$0")/../.."

# mirror.gcr.io serves Docker Hub's images without Docker Hub's anonymous pull
# limit, which shared cloud egress addresses hit.
IMAGE="${COCKROACH_IMAGE:-mirror.gcr.io/cockroachdb/cockroach:v25.3.3}"
CONTAINER=movie-club-local-db
DB_PORT="${LOCAL_DB_PORT:-26257}"
DATABASE_URL="postgresql://root@localhost:${DB_PORT}/movie_club?sslmode=disable"
MAILBOX_PORT="${MAILBOX_PORT:-8025}"
LOG_DIR="${TMPDIR:-/tmp}"

if ! docker info >/dev/null 2>&1; then
  # Cloud containers ship dockerd but do not start it.
  if [ "$(id -u)" = 0 ] && command -v dockerd >/dev/null; then
    # A container resumed from a snapshot keeps dockerd's and containerd's pid
    # files but not the processes, and the pids are often reused, so dockerd
    # refuses to start.
    pgrep -x dockerd >/dev/null || rm -f /var/run/docker.pid
    pgrep -x containerd >/dev/null || rm -f /var/run/docker/containerd/containerd.pid
    echo "Starting dockerd (log: $LOG_DIR/dockerd.log)"
    nohup dockerd >"$LOG_DIR/dockerd.log" 2>&1 &
    for _ in $(seq 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  fi
  docker info >/dev/null 2>&1 || { echo "Docker is not running." >&2; exit 1; }
fi

if ! docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  docker run -d --name "$CONTAINER" -p "${DB_PORT}:26257" "$IMAGE" \
    start-single-node --insecure >/dev/null
fi
docker start "$CONTAINER" >/dev/null

echo "Waiting for CockroachDB on port $DB_PORT"
until docker exec "$CONTAINER" ./cockroach sql --insecure \
  -e "CREATE DATABASE IF NOT EXISTS movie_club" >/dev/null 2>&1; do
  sleep 1
done

DATABASE_URL="$DATABASE_URL" npx tsx ./migrations/schemaMigrator.ts | tail -n 1

if curl -fsS "http://localhost:${MAILBOX_PORT}/emails" >/dev/null 2>&1; then
  echo "Mailbox already running on http://localhost:${MAILBOX_PORT}"
else
  MAILBOX_PORT="$MAILBOX_PORT" nohup npx tsx scripts/local/mailbox.ts \
    >"$LOG_DIR/movie-club-mailbox.log" 2>&1 &
  echo "Started mailbox on http://localhost:${MAILBOX_PORT} (log: $LOG_DIR/movie-club-mailbox.log)"
fi

ENV_MARKER="# Written by scripts/local/up.sh, which rewrites it on every run."
if [ -f .env ] && ! grep -qxF "$ENV_MARKER" .env; then
  echo "Kept your own .env. For the local database, it needs:"
  echo "  DATABASE_URL=$DATABASE_URL"
  echo "  RESEND_BASE_URL=http://localhost:${MAILBOX_PORT}"
else
  # The server reads TMDB_API_KEY / GOOGLE_BOOKS_API_KEY straight from the
  # shell, but title search runs in the browser, which only sees VITE_-prefixed
  # values. Netlify does not expand ${...} in .env, so they are copied here,
  # and re-running this script picks up a changed key. The session secret is
  # kept so a rewrite does not sign everyone out.
  SECRET=$(sed -n 's/^BETTER_AUTH_SECRET=//p' .env 2>/dev/null || true)
  cat >.env <<EOF
$ENV_MARKER
DATABASE_URL=$DATABASE_URL
BETTER_AUTH_URL=http://localhost:8888
BETTER_AUTH_SECRET=${SECRET:-$(openssl rand -hex 32)}
RESEND_API_KEY=re_local
RESEND_BASE_URL=http://localhost:${MAILBOX_PORT}
GOOGLE_CLIENT_ID=local-google-client-id
GOOGLE_CLIENT_SECRET=local-google-client-secret
VITE_TMDB_API_KEY=${TMDB_API_KEY:-}
VITE_GOOGLE_BOOKS_API_KEY=${GOOGLE_BOOKS_API_KEY:-}
EOF
  echo "Wrote .env for the local stack"
fi

echo "Ready. Next: netlify dev, then npm run local:seed"
