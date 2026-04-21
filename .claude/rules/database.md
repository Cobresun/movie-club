---
paths:
  - "migrations/**"
  - "lib/types/**"
  - "netlify/functions/repositories/**"
---

# Database Architecture

**ORM:** Kysely with CockroachDB dialect (PostgreSQL-compatible). See `kysely` skill for query patterns, migration syntax, and type helpers.

**Key Files:**

- Connection: `netlify/functions/utils/database.ts` (singleton `Kysely<DB>` instance)
- Generated types: `lib/types/generated/db.ts` (run `npm run codegen` after schema changes)
- Migrations: `migrations/schema/` (naming: `YYYYMMDD_Description.ts`)

**Key Tables:**

- `club` - Movie clubs (id, name, slug, legacy_id)
- `club_member` - Club membership with roles (club_id, user_id, role)
- `club_invite` - Invite tokens with expiration
- `club_settings` - Key-value settings storage (JSON values)
- `user` - User profiles (BetterAuth managed)
- `account` - OAuth accounts (BetterAuth managed)
- `session` - User sessions (BetterAuth managed)
- `verification` - Email verification tokens (BetterAuth managed)
- `movie_details` - Cached movie metadata from TMDB
- `work_list` - Generic list table. Each club has one or more user-defined lists (free-form titles, `system_type IS NULL`) plus optional system lists (`system_type = 'reviews' | 'award_nominations'`). A partial unique index `uq_work_list_club_system_type` enforces at most one of each system list per club. The legacy `type` enum was removed in `20260407_ArbitraryClubLists`.
- `work_comment` - Comments on movie works (club_id, content, spoiler, user_id, work_id)
- `review` - Movie reviews with scores
- `awards_temp` - Temporary awards data storage (JSON)
- `movie_directors` - Movie-to-director junction table
- Various movie metadata junction tables (genres, production companies, countries)

**Enums:** `WorkListSystemType` (reviews, award_nominations), `WorkType` (movie)

## Migration Workflow

Always validate schema migrations against a **freshly spawned dev database**, never against your personal `.env`-pointed DB.

**Why this matters — blast radius of shared `dev`.** The Netlify `preview-database` plugin (`netlify/plugins/preview-database/index.js`) points every PR that *does not* change migrations straight at shared `dev`. So if you run `migrate:dev` with `.env` still pointing at `postgresql://.../dev`, you rewrite the schema underneath every other open PR's deploy preview at once — their code still expects the old schema and their previews 500 until the migration is reverted on shared `dev` and the previews are rebuilt. The spawn-first rule isn't about cleanliness; it's the only thing that keeps this blast radius from firing.

```bash
# 1. Spawn a fresh DB from the latest snapshot. Names must use only
#    lowercase letters, numbers, and underscores — hyphens are rejected.
npm run db:spawn arbitrary_lists

# 2. Run the migrator + codegen against the new DB without touching .env.
#    Inline DATABASE_URL takes precedence over the value loaded from
#    --env-file=.env. The .env file is still needed so TMDB_API_KEY is
#    available for the data-backfill step inside
#    20260315_AddPersonProfilePaths.ts (it calls TMDB and 401s without it).
DATABASE_URL='<spawned-url>' npx tsx --env-file=.env ./migrations/schemaMigrator.ts
DATABASE_URL='<spawned-url>' npm run codegen

# 3. Clean up when done.
npm run db:cleanup arbitrary_lists
```

### CockroachDB migration gotchas

- **No transactional DDL.** A migration that errors midway leaves the database in an intermediate state — created enums and columns persist. Plan to either make `up()` idempotent or expect to manually drop the orphans (`DROP TYPE IF EXISTS ...`, `ALTER TABLE ... DROP COLUMN IF EXISTS ...`) before re-running.
- **Cannot drop UNIQUE constraints with `ALTER TABLE DROP CONSTRAINT`.** CockroachDB stores unique constraints as unique indexes; use `DROP INDEX <name> CASCADE` instead. (See crdb issue #42840.)
- **Cannot drop an enum while a column still references it.** Drop the column first, then `DROP TYPE`.
- **Embedded data backfills inside schema migrations** (like `20260315_AddPersonProfilePaths.ts`) require their full env (e.g. `TMDB_API_KEY`). Migrations aren't pure schema in this repo.

