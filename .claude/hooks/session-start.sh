#!/usr/bin/env bash
#
# Cloud containers ship dockerd without starting it, and `npm test` needs it:
# the integration project runs CockroachDB through testcontainers. Local
# machines manage their own Docker, so this does nothing outside the cloud.
# Dependencies are installed by the cloud environment's setup script.

set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0

# SessionStart stdout is added to Claude's context, so speak only on failure.
if ! out=$(bash "$CLAUDE_PROJECT_DIR/scripts/local/start-docker.sh" 2>&1); then
  echo "Docker did not start, so \`npm test\` will fail in its integration project (\`npm run test:unit\` still works): $out"
fi
exit 0
