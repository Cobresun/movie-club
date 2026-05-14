# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Detailed architecture docs are in `.claude/rules/`.

## Project Overview

Movie Club is a Vue 3 web application for managing movie clubs, reviews, custom lists, and awards. It uses Netlify Functions for the backend API, CockroachDB (PostgreSQL-compatible) for data storage, and BetterAuth for authentication.

## Code Quality

Code quality checks (`npm run type-check` and `npm run lint`) run automatically via Claude Code hooks after every file edit. Run `npm test` manually when changes affect tested code.

## Claude Code Skills

Skills in `.claude/skills/` provide domain-specific guidance for Claude Code sessions. Available skills:

- **better-auth-best-practices** — BetterAuth integration guide with config options, session management, plugins, and common gotchas. Automatically consulted when working on authentication features.
- **vue-best-practices** — Vue 3 Composition API guide covering reactivity, SFC structure, component data flow, composables, and performance. Automatically consulted when working on Vue components.
- **tanstack-query-vue** — TanStack Query v4 patterns for data fetching, caching, mutations, and optimistic updates. Automatically consulted when working on service composables or server state.
- **kysely** — Kysely v0.27 query builder patterns with CockroachDB dialect. Automatically consulted when working on database queries, repositories, or migrations.
- **playwright-cli** — Browser automation for web testing, form filling, screenshots, and data extraction.

## Development Commands

### Running the Application

```bash
netlify dev
```

Runs the full application including Netlify functions with hot-reload. This is the primary development command.

**Important Development Setup:**

- Use the `cobresunofficial@gmail.com` account for development
- The `.env` file for development is documented in the Cobresun Notion

### Building and Testing

```bash
npm run build          # Migrate, type-check, lint, test, then build for production
npm run type-check     # Run TypeScript type checking without emitting files
npm run lint           # Lint src, migrations, netlify/functions, lib, and scripts directories
npm test               # Run tests once
npm run test:watch     # Run tests in watch mode
npm run coverage       # Run tests with coverage report
```

### Database Migrations

**Schema Migrations:**

```bash
npm run migrate:dev    # Apply schema migrations for development (uses .env file)
npm run migrate:down   # Revert last schema migration (development only)
npm run migrate        # Apply schema migrations for deployment (no .env file)
```

**Data Migrations:**

```bash
npm run migrate:data -- <YourDataMigration>  # Run specific data migration
```

**Code Generation:**

```bash
npm run codegen        # Generate TypeScript types from database schema using kysely-codegen
```

Migration files are located in `migrations/schema/` and must follow the naming convention: `<dateISO>_<yourchanges>` (e.g., `20240201_AddClubTable.ts`).

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

## Common Patterns

### Feature Module Structure

```
src/features/<feature-name>/
  ├── views/            # Page-level components (routed)
  ├── components/       # Feature-specific components
  ├── composables/      # Vue composables (if needed)
  ├── tests/            # Feature tests (if any)
  └── constants.ts      # Feature constants (if needed)
```

### Adding a New API Endpoint

1. Create handler in appropriate `netlify/functions/` directory
2. Use the custom Router class for routing
3. Add middleware for validation (`validClubSlug`, `validListId` for list-scoped routes) and auth (`loggedIn`, `secured`)
4. Use Zod schemas for request body validation
5. Use Kysely with generated types for database queries
6. Return responses using utility functions from `utils/responses.ts`

### Adding a Database Table

1. Create migration in `migrations/schema/` with ISO date prefix (YYYYMMDD)
2. Run `npm run migrate:dev` to apply migration
3. Run `npm run codegen` to regenerate TypeScript types
4. Create repository class in `netlify/functions/repositories/` for data access

### Adding a Frontend Feature

1. Create feature directory in `src/features/<feature-name>/`
2. Add views to `views/` subdirectory
3. Create service composable in `src/service/use<Feature>.ts` for API calls
4. Add routes in `src/router/index.ts` with appropriate `depth` meta
5. Apply `beforeEnter: checkClubAccess` guard for club-scoped routes

## External Services

- **TMDB** — Movie metadata API (`netlify/functions/utils/tmdb.ts`)
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

Netlify provides automatically: `URL` (production), `DEPLOY_PRIME_URL` (deploy preview)
