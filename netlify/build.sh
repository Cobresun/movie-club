#!/usr/bin/env bash
#
# Netlify build command. Deploy-only work: the quality gates (type-check, lint,
# format, test) run in GitHub Actions (.github/workflows/ci.yml) so they don't
# burn Netlify build minutes.
#
# Invoked through `timeout` from netlify.toml — see the comment there.

set -euo pipefail

# `npm run migrate` applies pending schema migrations to whichever database this
# context targets (production on a production build, the spawned pr_<id> or
# shared dev database on a preview) and regenerates lib/types/generated/db.ts.
#
# The preview-database plugin sets SKIP_SCHEMA_MIGRATE only for deploy previews
# whose diff against main touches no migration files. Those previews point at
# shared `dev`, which the plugin's onSuccess hook already advanced to main's
# schema on the last production deploy, so there is nothing to apply — and with
# no migration in the diff, the committed types cannot have gone stale either.
# Skipping saves a tsx cold start, a CockroachDB round trip and a full schema
# introspection on the large majority of builds.
#
# Any other context leaves the variable unset and migrates as before, so a
# plugin failure degrades to the old behaviour rather than skipping a migration
# that was actually needed.
if [ "${SKIP_SCHEMA_MIGRATE:-}" = "true" ]; then
  echo "→ No schema migrations in this PR; skipping migrate + codegen"
else
  npm run migrate

  # GitHub Actions type-checks against the *committed* db.ts and has no database
  # to introspect, so a stale generated file would otherwise reach production
  # unnoticed. Migrating here regenerates it; a non-empty diff means whoever
  # wrote the migration forgot to run codegen.
  if ! git diff --exit-code -- lib/types/generated; then
    echo "Generated DB types are stale: run npm run codegen and commit lib/types/generated/db.ts"
    exit 1
  fi
fi

npx vite build
