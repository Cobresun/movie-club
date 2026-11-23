#!/usr/bin/env bash
#
# Starts dockerd if Docker isn't running, for machines that ship it without
# starting it (Claude Code cloud containers). Used by `npm run local:up` and the
# SessionStart hook in .claude/hooks/session-start.sh. Exits non-zero if Docker
# still isn't running.

set -euo pipefail

LOG_DIR="${TMPDIR:-/tmp}"

if ! docker info >/dev/null 2>&1; then
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
