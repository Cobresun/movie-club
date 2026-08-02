# CLAUDE.md

Movie Club is a Vue 3 app for managing movie/book clubs, reviews, custom lists, and awards. Netlify Functions for the API, CockroachDB via Kysely, BetterAuth for auth. Architecture notes live in `.claude/rules/`, loaded by path.

## Non-obvious setup

- **Run the app with `netlify dev`**, not `npm run dev` — the functions backend won't exist otherwise.
- Sign in locally as `cobresunofficial@gmail.com`. The dev `.env` contents are in the Cobresun Notion.
- `GEMINI_API_KEY` and `ADMIN_USER_EMAILS` are the env vars **not** synced to local `.env` — both are Netlify-console-only. For the discussion-questions feature, get your own key at https://aistudio.google.com/apikey. `ADMIN_USER_EMAILS` is a comma-separated email allowlist and the _entire_ authorization mechanism for `/api/admin/*` (the schema has no admin role — `club_member.role` is per-club and unenforced); it fails closed, so leaving it unset hides `/admin` from everyone rather than exposing it.
- Lint/format is oxlint + oxfmt, not ESLint/Prettier. `type-check` and `lint` run automatically via hooks after each edit, so you rarely need to invoke them; `npm test` is manual.
- **`npm test` needs Docker running.** The `integration` Vitest project starts a throwaway CockroachDB and runs every Netlify function handler against it. `npm run test:unit` skips it; `npm run test:integration` runs only it. See `.claude/rules/testing.md`.

## Database workflow

Schema migrations live in `migrations/schema/` and must be named `<YYYYMMDD>_<Description>.ts` — the migrator orders by filename. (`migrations/data/` and `npm run migrate:data -- <Name>` are the legacy path; new data rewrites go in schema migrations.)

`npm run db:snapshot | db:spawn | db:list | db:cleanup` back a snapshot/restore workflow that gives you a throwaway CockroachDB from a copy of dev data — see the scripts in `package.json`. Spawned names take underscores, not hyphens.

**Never point `migrate:dev` at shared `dev`.** Spawn first. `.claude/rules/database.md` explains the blast radius; there is a guard rail, but it fails open.
