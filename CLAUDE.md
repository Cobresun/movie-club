# CLAUDE.md

Movie Club is a Vue 3 app for managing movie, book and TV clubs, reviews, custom lists, and awards. Netlify Functions for the API, CockroachDB via Kysely, BetterAuth for auth. Architecture notes live in `.claude/rules/`, loaded by path.

## Non-obvious setup

- **Run the app with `netlify dev`**, not `npm run dev` — the functions backend won't exist otherwise.
- Sign in locally as `cobresunofficial@gmail.com`. The dev `.env` contents are in the Cobresun Notion.
- `GEMINI_API_KEY` and `ADMIN_USER_EMAILS` are the env vars **not** synced to local `.env` — both are Netlify-console-only. For the discussion-questions feature, get your own key at https://aistudio.google.com/apikey. `ADMIN_USER_EMAILS` is a comma-separated email allowlist and the _entire_ authorization mechanism for `/api/admin/*` (the schema has no admin role — `club_member.role` is per-club and unenforced); it fails closed, so leaving it unset hides `/admin` from everyone rather than exposing it.
- Lint/format is oxlint + oxfmt, not ESLint/Prettier. `type-check` and `lint` run automatically via hooks after each edit, so you rarely need to invoke them; `npm test` is manual.
- **`npm test` needs Docker running.** The `integration` Vitest project starts a throwaway CockroachDB and runs every Netlify function handler against it. `npm run test:unit` skips it; `npm run test:integration` runs only it. See `.claude/rules/testing.md`.

## What review will ask for

The rules in `.claude/rules/` are largely a record of corrections that came back more than once. Four account for most of them:

1. **Every query is a typed Kysely query** — repositories, providers and migrations alike, including pre-existing raw SQL in code you are already editing (`database.md`).
2. **Club-type variation lives in the registry**, never in an inline `clubType === …` branch — on the backend too, where it means the `MediaProvider`, not a `WorkType` switch in a shared query (`code-quality.md`, `backend-architecture.md`).
3. **Tests assert what a user sees, through the queries a user would use** — no CSS selectors, no assertions on outgoing requests, no direct database reads, no hand-rolled harness where a shared helper exists (`testing.md`).
4. **The PR contains only the change it claims to** — no stray endpoints, lockfile churn, drive-by reformatting, or half-removed features (`code-quality.md`).

When a correction lands here a second time, write it into these files as part of the same PR; they are reviewed like code and are expected to stay true.

## Database workflow

Schema migrations live in `migrations/schema/`. A new one is named `<Description>.ts`, with no date, default-exports `{ name, up, down }`, and is appended to the end of `migrations/orderedMigrations.ts`. That list sets the run order; the dated files are from before it existed. (`migrations/data/` and `npm run migrate:data -- <Name>` are the legacy path; new data rewrites go in schema migrations.)

`npm run db:snapshot | db:spawn | db:list | db:cleanup` back a snapshot/restore workflow that gives you a throwaway CockroachDB from a copy of dev data — see the scripts in `package.json`. Spawned names take underscores, not hyphens.

**Never point `migrate:dev` at shared `dev`.** Spawn first. `.claude/rules/database.md` explains the blast radius; there is a guard rail, but it fails open.

## A fully local stack (no shared database)

`npm run local:up` starts a single-node CockroachDB in Docker, migrates it from scratch, starts `scripts/local/mailbox.ts` — a stand-in for Resend on `:8025`, reached through `RESEND_BASE_URL` — and writes a `.env` for both if there is none (it never overwrites yours). Then `netlify dev`, then `npm run local:seed`, which signs up `dev@movie.club` / `movie-club-local` and a second member through the real sign-up and email-verification flow and creates one club per type. Re-running either is safe. Verification and password-reset emails land in the mailbox, so those flows work end to end.

The database starts empty, and TMDB / Google Books calls need real `TMDB_API_KEY` / `GOOGLE_BOOKS_API_KEY` in the shell (both are query parameters, so they cannot be injected as headers). Google OAuth does not work locally.

In Claude Code cloud sessions: Docker Hub rate-limits the shared egress, so images come from `mirror.gcr.io` (set `TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX=mirror.gcr.io/` for `npm test`); `local:up` starts `dockerd` when it is not running; and `netlify dev` needs `--internal-disable-edge-functions`, because the edge runtime downloads Deno from a host the sandbox blocks. That only drops the `/share/...` link previews.

## Working on an existing PR

When asked to update a PR, address its review comments, fix its CI, or anything similar, push the changes to **that PR's own branch**. Never open a new PR (stacked or otherwise) for that work.
