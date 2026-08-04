---
paths:
  - "migrations/**"
  - "lib/types/**"
  - "netlify/functions/repositories/**"
---

# Database

Kysely with the CockroachDB dialect (PostgreSQL-compatible). See the `kysely` skill for query patterns, migration syntax, and type helpers.

- Connection: `netlify/functions/utils/database.ts` (singleton `Kysely<DB>`)
- **Schema of record: `lib/types/generated/db.ts`** — every table, column, and enum. Read it rather than trusting any prose summary; run `npm run codegen` after schema changes to regenerate it.
- Migrations: `migrations/schema/`, named `YYYYMMDD_Description.ts`

The shape worth knowing before you read: a `work` is a movie or book; `work_list` holds a club's lists, either user-defined (`system_type IS NULL`, free-form title) or system (`system_type = 'reviews'`), with a partial unique index enforcing at most one of each system list per club. Movie and book metadata are cached in separate `*_details` tables with their own junction tables.

## Query gotcha: `selectAll()` after a join

`selectAll()` with a join lets joined columns silently shadow base-table ones of the same name — the row typechecks, but you read the wrong value at runtime. Use `selectAll("table")` to scope it. Worth grepping for whenever a migration adds a column to a table that appears on the joined side of an existing query.

## Migration workflow

**Write backfills as typed Kysely queries, not `sql` template strings.** The `Kysely<unknown>` handle a migration receives knows no tables; `db.withTables<{...}>()` teaches it the columns that migration touches — including ones it just added — so identifiers are schema-checked. Raw `sql` is for DDL the builder can't express (`ADD COLUMN IF NOT EXISTS`, `DROP INDEX ... CASCADE`). See the `kysely` skill → Migrations.

**Validate schema migrations against a freshly spawned database, never your `.env`-pointed one.**

This isn't tidiness. The `preview-database` plugin points every PR that _doesn't_ change migrations straight at shared `dev`. Running `migrate:dev` with `.env` on `postgresql://.../dev` rewrites the schema underneath every other open PR's deploy preview at once — their code expects the old schema, and their previews 500 until it's reverted and they're rebuilt.

```bash
# 1. Spawn from the latest snapshot (lowercase, numbers, underscores — no hyphens).
npm run db:spawn arbitrary_lists

# 2. Migrate + codegen against it without touching .env. An inline DATABASE_URL
#    beats the --env-file value; .env is still needed because some migrations
#    call external APIs during backfill (see below).
DATABASE_URL='<spawned-url>' npx tsx --env-file=.env ./migrations/schemaMigrator.ts
DATABASE_URL='<spawned-url>' npm run codegen

# 3. Clean up.
npm run db:cleanup arbitrary_lists
```

**Guard rail.** `schemaMigrator.ts` refuses to run against shared `dev` when `migrations/schema/` contains files not on `origin/main`, including uncommitted ones. It does _not_ cover `migrate:down`, can be bypassed with `FORCE_DEV_MIGRATE=1`, and **fails open when git is unavailable** — so it reduces the blast radius above, it doesn't remove it. If it false-positives on a freshly merged migration, `git fetch` to update `origin/main`.

**Shared `dev` self-syncs after merge.** The plugin's `onSuccess` hook migrates shared `dev` on every production deploy, so it tracks `main` unattended. Running `migrate:dev` against `dev` yourself is a fallback for when that hook failed.

## CockroachDB gotchas

- **No transactional DDL.** A migration erroring midway leaves created enums and columns behind. Either make `up()` idempotent or expect to drop orphans by hand (`DROP TYPE IF EXISTS`, `ALTER TABLE ... DROP COLUMN IF EXISTS`) before re-running.
- **`ALTER TABLE DROP CONSTRAINT` can't drop UNIQUE** — CockroachDB stores those as unique indexes. Use `DROP INDEX <name> CASCADE` (crdb #42840).
- **An enum can't be dropped while a column references it.** Drop the column first.
- **`up()`/`down()` already run inside a transaction** — don't open another with `db.transaction()`.
- **Migrations here aren't pure schema.** Some embed data backfills that call external APIs and need the matching env var (`20260315_AddPersonProfilePaths.ts` calls TMDB and 401s without `TMDB_API_KEY`).
