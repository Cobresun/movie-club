#!/usr/bin/env bash
#
# When Claude ends a turn, runs CI's format, type and lint checks on every file
# the branch changes: committed since it left origin/main, uncommitted, or new
# and untracked. Files edited through Bash never pass the PostToolUse
# formatter, so the format check here is what catches them before CI does.
#
# A failure exits 2 with the output on stderr: that is the only way a Stop
# hook's result reaches Claude. Any other non-zero exit only puts a notice in
# the transcript and lets the turn end.

set -uo pipefail

source "$(cd "$(dirname "$0")" && pwd)/ci-paths.sh"

input=$(cat)
cwd=$(jq -r '.cwd // empty' <<<"$input")
cd "$(git -C "${cwd:-$CLAUDE_PROJECT_DIR}" rev-parse --show-toplevel)" || exit 0

# Claude is already continuing because this hook blocked once. Report again,
# but let the turn end, so a failure Claude can't fix doesn't loop.
block=2
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = true ] && block=1

base=$(git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD)
mapfile -t changed < <(
  {
    git diff --name-only --diff-filter=d "$base" -- "${ci_paths[@]}"
    git ls-files --others --exclude-standard -- "${ci_paths[@]}"
  } | sort -u
)
[ ${#changed[@]} -eq 0 ] && exit 0

code=()
for f in "${changed[@]}"; do
  case "$f" in *.vue | *.ts | *.mts | *.cts | *.js | *.mjs | *.cjs) code+=("$f") ;; esac
done

report=""
check() {
  local out
  if ! out=$("$@" 2>&1); then
    report+=$'\n\n$ '"$*"$'\n'"$out"
  fi
}

check npx oxfmt --check --no-error-on-unmatched-pattern "${changed[@]}"
if [ ${#code[@]} -gt 0 ]; then
  check npm run --silent type-check
  check npx oxlint --deny-warnings "${code[@]}"
fi

[ -z "$report" ] && exit 0
echo "CI will fail on files this branch changes. Fix these (\`npx oxfmt <file>\` formats one):$report" >&2
exit "$block"
