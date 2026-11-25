# The folders `npm run format:check` and `npm run lint` cover (package.json).
# Sourced by the hooks so they check what CI checks and touch nothing else.
# shellcheck disable=SC2034
ci_paths=(src migrations netlify lib scripts)
