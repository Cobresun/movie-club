---
paths:
  - "migrations/**"
  - "lib/types/**"
  - "netlify/functions/**"
---

# Database

Kysely with the CockroachDB dialect; see the `kysely` skill for syntax. The schema of record is `lib/types/generated/db.ts`. Read it rather than any prose summary, and run `npm run codegen` after a schema change.

## Model

- A `work` is a movie, a book, a TV show, or an episode. Metadata is cached per type in `*_details` tables.
- A `work_list` is user-defined (`system_type IS NULL`) or a system list (`'reviews'`, at most one per club by a partial unique index).
- An episode is a child work of its show (`work.parent_work_id`). Only the show is on a list; deleting it cascades to its episodes and their reviews.
- A show and each episode carry their own reviews. A show score is never written to its episodes. A season is never a work: it is each member's episode average, computed in the client (`reviewTree.ts`).
- A TV `external_id` is an address: `"95396"` is a show, `"95396:1:4"` an episode. `tv_season_details` is keyed by a season address (`"95396:1"`) that no work carries. Parse addresses with `parseTvAddress` only inside the TV provider; everywhere else `external_id` is an opaque string.

## Every query is typed Kysely

Raw `sql` is unchecked against the schema and fails in production instead of at `type-check`. This applies to repositories, providers, scheduled functions and migrations, and to an existing raw query you are editing.

- In a migration, `db.withTables<{…}>()` gives the `Kysely<unknown>` handle types for the tables it touches, backfills included.
- Use the typed `eb.case()` builder and expression helpers before `sql`.
- Raw `sql` is acceptable only for:
  - DDL the builder can't express: `ALTER TYPE … ADD VALUE`, `ADD COLUMN IF NOT EXISTS`, `DROP INDEX … CASCADE`, `CREATE`/`DROP DATABASE`.
  - A `CASE` over a caller-supplied id list (`ListRepository.reorderLists`, `reorderList`).
  - A scalar expression with no builder function, as a typed fragment (`sql<number>` for `COALESCE(MAX(position), 0) + 1`).
- Write many rows in one statement: `insertInto(…).values(rows.map(…))` with `onConflict` for an upsert (`utils/tvDetailsUpdater.ts`), never a query per row.
- Use `selectAll("table")` after a join. Bare `selectAll()` lets joined columns silently shadow base-table columns of the same name. Grep for it when a migration adds a column to a joined table.
- Declare a small interface for a row a provider or repository hands onward, rather than exporting the inferred join type.

## Migrations

- **Validate against a freshly spawned database, never shared `dev`.** PRs without migrations preview against `dev`, so migrating it breaks every other open preview.

  ```bash
  npm run db:spawn my_change
  DATABASE_URL='<spawned-url>' npx tsx --env-file=.env ./migrations/schemaMigrator.ts
  DATABASE_URL='<spawned-url>' npm run codegen
  npm run db:cleanup my_change
  ```

  `.env` is still needed: some backfills call external APIs (`TMDB_API_KEY`).

- The guard in `schemaMigrator.ts` refuses shared `dev` when there are migrations not on `origin/main`. It does not cover `migrate:down`, is bypassed by `FORCE_DEV_MIGRATE=1`, and fails open without git. `git fetch` if it false-positives.
- **Append to `migrations/orderedMigrations.ts`; never reorder.** A migration is recorded under its position (`m0035_AddFoo`), so moving an entry renames everything below it and Kysely refuses to run. On a conflict keep `main`'s entries first. A file not in the list never runs.
- **Never hardcode row ids.** Dev and production ids differ, so the migration silently no-ops in production. Resolve rows by a natural key.
- **Backfill only data production holds.** An unshipped feature has rows only in throwaway databases; change the schema and skip the backfill.
- **Previews migrate forward from a fresh copy**, never up → down → up. `down()` rarely inverts `up()` exactly, so a reused preview drifts from production.
- Shared `dev` migrates itself on each production deploy. Running `migrate:dev` against it is a fallback for when that hook failed.

## CockroachDB gotchas

- **No transactional DDL.** A migration that fails midway leaves enums and columns behind. Make `up()` idempotent or drop the orphans by hand.
- `up()` and `down()` already run in a transaction. Don't open another.
- `ALTER TABLE DROP CONSTRAINT` can't drop a UNIQUE. Use `DROP INDEX <name> CASCADE`.
- An enum can't be dropped while a column references it. Drop the column first.
- **Never combine `.distinct()` with `.filterWhere()`.** Several `count(DISTINCT x)` with different `FILTER` clauses in one SELECT return wrong counts with no error, depending on data and plan. Give each its own query (`MetricsRepository.countActivity`).
