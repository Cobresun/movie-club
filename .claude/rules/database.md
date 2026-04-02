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
- `work_list` - Generic list for reviews, watchlist, backlog, awards
- `work_comment` - Comments on movie works (club_id, content, spoiler, user_id, work_id)
- `review` - Movie reviews with scores
- `awards_temp` - Temporary awards data storage (JSON)
- `movie_directors` - Movie-to-director junction table
- Various movie metadata junction tables (genres, production companies, countries)

**Enums:** `WorkListType` (reviews, watchlist, backlog, award_nominations), `WorkType` (movie)
