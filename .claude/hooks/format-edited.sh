#!/usr/bin/env bash
#
# Formats a file Claude wrote or edited, if CI's format check covers it.
# Formatting anything else (workflows, CLAUDE.md, rules) leaves drive-by diffs
# in files no check asks to be formatted.

set -uo pipefail

f=$(jq -r '.tool_input.file_path // empty')
[ -n "$f" ] && [ -f "$f" ] || exit 0
root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null) || exit 0
rel=$(realpath --relative-to="$root" "$f")

source "$(dirname "$0")/ci-paths.sh"
for p in "${ci_paths[@]}"; do
  case "$rel" in
    "$p"/*)
      cd "$root" && npx oxfmt "$rel" >/dev/null 2>&1
      exit 0
      ;;
  esac
done
exit 0
