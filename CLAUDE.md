# CLAUDE.md

Movie Club: a Vue 3 app for movie, book and TV clubs — reviews, lists, awards. Netlify Functions API, CockroachDB via Kysely, BetterAuth. Path-scoped rules are in `.claude/rules/`.

## Setup

- Run the app with `netlify dev`, not `npm run dev`; the functions backend doesn't exist otherwise.
- Sign in locally as `cobresunofficial@gmail.com`. The dev `.env` contents are in the Cobresun Notion.
- `GEMINI_API_KEY` and `ADMIN_USER_EMAILS` are set only in the Netlify console, not in local `.env`. `ADMIN_USER_EMAILS` (comma-separated) is the entire authorization for `/api/admin/*` and fails closed: unset hides `/admin` from everyone.
- Lint and format are oxlint and oxfmt. Hooks format each file you edit and run `type-check` and oxlint on changed files when a turn ends. `npm run lint` also runs knip and `lint/check.mjs`; run it and `npm test` yourself before pushing.
- `npm test` needs Docker running (the integration project starts CockroachDB). `npm run test:unit` skips it.

## Database

- A new migration is `migrations/schema/<Description>.ts` (no date), default-exports `{ name, up, down }`, and is appended to `migrations/orderedMigrations.ts`. Data rewrites go in schema migrations; `migrations/data/` is legacy.
- Never run `migrate:dev` against shared `dev`. Spawn a copy first with `npm run db:spawn <name>` (underscores, no hyphens); `db:snapshot`, `db:list` and `db:cleanup` go with it. Details in `database.md`.

## What review sends back

These account for most review comments. Each has come back after being written down, usually in a form the rule had not named.

1. **Raw SQL.** Every query is typed Kysely, including existing raw SQL in code you are editing.
2. **Club-type branches.** Variation lives in the registry (frontend) or the `MediaProvider` (backend), never inline. A default type while the club loads, a type guard choosing a widget, and TV logic in a shared handler are all branches.
3. **Tests that don't act like a user.** No CSS selectors, assertions on outgoing requests, clipboard spies, database reads, or hand-rolled harnesses.
4. **Casts.** `as`, `!`, `as never`: narrow or parse instead.
5. **Leftovers.** Fields nothing reads, unreachable branches and stale comments from the PR's own first design; stray endpoints, lockfile churn, drive-by reformatting.
6. **Hand-written checks and helpers** where `lib/checks/checks.ts` or an existing helper already does the job.

`npm run lint` catches the mechanical part of each: the `review/*` rules in `lint/review-plugin.mjs`, and knip for unused files, exports and dependencies. Existing violations are grandfathered per file in `lint/baseline.json`, which may only shrink. After fixing one, run `npm run lint:baseline` and commit the smaller file. Never regenerate it to absorb a new violation: lint compares it with `main` and fails if any count grew.

## Pull requests

- To update a PR (review comments, CI), push to that PR's branch. Never open a new one.
- Before asking for review, merge `main`, resolve conflicts and rerun lint and tests. Reviews stop when the diff shows code `main` has already rewritten.
- Read `git diff --stat origin/main...` for files that don't belong, and `gh pr list` for overlapping work. Don't ship an intermediate step on its own, or tests for code another open PR is rewriting.
- These files are reviewed like code. When a change makes a sentence here wrong, or a correction arrives a second time, fix the files in the same PR. Grep `.claude/rules/` for the old term: rules are path-scoped, so the stale sentence is often in a file that wasn't loaded.
