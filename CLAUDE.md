# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Detailed architecture docs are in `.claude/rules/`.

## Project Overview

Movie Club is a Vue 3 web application for managing movie clubs, reviews, custom lists, and awards. It uses Netlify Functions for the backend API, CockroachDB (PostgreSQL-compatible) for data storage, and BetterAuth for authentication.

## Code Quality

Code quality checks (`npm run type-check` and `npm run lint`) run automatically via Claude Code hooks after every file edit. Run `npm test` manually when changes affect tested code. Linting uses oxlint (with `oxlint.config.ts`) and formatting uses oxfmt (with `.oxfmtrc.json`).

## Development Commands

### Running the Application

```bash
netlify dev
```

Runs the full application including Netlify functions with hot-reload. This is the primary development command.

**Important Development Setup:**

- Use the `cobresunofficial@gmail.com` account for development
- The `.env` file for development is documented in the Cobresun Notion

### Database Migrations

Build, test, lint, and migration scripts are all in `package.json`. Two things that aren't obvious from the script names:

- Data migrations take the migration name as an argument: `npm run migrate:data -- <YourDataMigration>`
- Migration files live in `migrations/schema/` and must follow the naming convention `<dateISO>_<yourchanges>` (e.g. `20240201_AddClubTable.ts`)

### Database Management

The project uses CockroachDB's BACKUP/RESTORE with S3 to create isolated database environments for development and deploy previews.

```bash
npm run db:snapshot         # Create backup snapshot of dev database to S3
npm run db:snapshot prod    # Snapshot production database
npm run db:spawn my_feature # Create personal dev database from latest snapshot (use underscores, not hyphens)
npm run db:list             # List all databases with metadata
npm run db:cleanup my_feature       # Delete personal database when done
npm run db:cleanup --older-than 7   # Clean up databases older than 7 days
```

Snapshots are stored in `s3://movie-club-crdb-dev-exports`. The spawn command creates `dev_{username}_my-feature` by restoring from the latest S3 snapshot.

**Required env vars:** `DATABASE_URL`, `AWS_ACCESS_KEY_COCKROACH_BACKUP`, `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP`

## Key Conventions

- **Type guards:** Always use utilities from `lib/checks/checks.ts` (`hasValue`, `isDefined`, `hasElements`, `ensure`) instead of manual null/undefined checks. See `.claude/rules/code-quality.md` for details.
- **No `as` casts:** Never use `as` type casting in tests or production code.
- **No `watch()`:** Prefer keyed components over `watch()` for query data. See `.claude/rules/code-quality.md` for rationale and exceptions.

## External Services

- **TMDB** — Movie metadata API (`netlify/functions/utils/tmdb.ts`)
- **Google Books** — Book metadata API (`netlify/functions/utils/providers/googleBooks.ts`)
- **BetterAuth** — Authentication (email/password + Google OAuth)
- **CockroachDB** — PostgreSQL-compatible distributed database
- **Cloudinary** — Image hosting for profile photos
- **Resend** — Transactional email (verification, password reset)

## Environment Variables

Required environment variables (documented in Cobresun Notion):

- `DATABASE_URL` - CockroachDB connection string
- `AWS_ACCESS_KEY_COCKROACH_BACKUP` / `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP` - S3 backups
- `BETTER_AUTH_URL` - Base URL for BetterAuth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `RESEND_API_KEY` - Resend email API key
- `CLOUDINARY_URL` - Cloudinary configuration URL
- `TMDB_API_KEY` - TMDB API key for movie data
- `GOOGLE_BOOKS_API_KEY` / `VITE_GOOGLE_BOOKS_API_KEY` - Google Books API key for book metadata (backend) and book search/browse (frontend); one Google Cloud key can back both
- `GEMINI_API_KEY` - Google AI Studio key used by the experimental "discussion questions" feature (calls the `gemini-3.5-flash` model). **This is a Netlify-console-only secret and is NOT synced to your local `.env`.** To exercise the feature locally, generate your own key at https://aistudio.google.com/apikey and add `GEMINI_API_KEY=<your-key>` to `.env`. Deploys read the value from the Netlify console.

Netlify provides automatically: `URL` (production), `DEPLOY_PRIME_URL` (deploy preview)
