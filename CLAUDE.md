# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Movie Club is a Vue 3 web application for managing movie clubs, reviews, watchlists, and awards. It uses Netlify Functions for the backend API, CockroachDB (PostgreSQL-compatible) for data storage, and BetterAuth for authentication.

## Development Commands

### Running the Application

```bash
netlify dev
```

Runs the full application including Netlify functions with hot-reload. This is the primary development command.

**Important Development Setup:**
- Use the `cobresunofficial@gmail.com` account for development

### Building and Testing

```bash
npm run build          # Type-check, run tests, migrate DB, then build for production
npm run type-check     # Run TypeScript type checking without emitting files
npm run lint           # Lint src, migrations, netlify/functions, and lib directories
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

The `.env` file for development is documented in the Cobresun Notion.

## Architecture

### Frontend Architecture (Vue 3 + Vite)

**Project Structure:**
- `src/features/` - Feature-based modules (clubs, reviews, awards, watch-list, statistics, settings, profile)
  - Each feature contains `views/`, `components/`, and sometimes `composables/` or `tests/`
- `src/common/` - Shared components, utilities, and error codes
- `src/stores/` - Pinia stores (currently only `auth.ts`)
- `src/router/` - Vue Router configuration with auth guards

**Key Technologies:**
- **Vue 3** with Composition API and `<script setup>`
- **Vite** for build tooling
- **TypeScript** with strict mode
- **Pinia** for state management
- **Vue Router 4** with route-based code splitting
- **TanStack Query (Vue Query)** for server state management with persistence
- **BetterAuth** (better-auth/vue) for authentication
- **Tailwind CSS** for styling
- **Vitest** for testing with jsdom environment
- **mdi-vue** for Material Design Icons
- **vue-toastification** for toast notifications

**Global Components:**
Registered in `src/main.ts`: `v-avatar`, `v-btn`, `v-select`, `v-switch`, `loading-spinner`, `movie-table`, `menu-card`, `v-modal`, `page-header`

**Path Alias:**
- `@/*` maps to `src/*`

**Router Architecture:**
- Routes use a `depth` meta property for slide-in/slide-out transitions
- `checkClubAccess` guard ensures users are club members before accessing club routes
- Route transitions use animate.css classes (`animate__slideInRight`, `animate__slideInLeft`, etc.)

**Query Caching:**
- Vue Query persists to localStorage with 1-week cache time
- Custom refetch logic limits remounts to avoid excessive refetching
- User query data is never persisted

### Backend Architecture (Netlify Functions)

**Custom Router System:**
Located in `netlify/functions/utils/router.ts`. A type-safe Express-like router implementation that supports:
- Middleware chaining with type transformations
- Path parameter extraction using `path-parser`
- Method routing (GET, POST, PUT, DELETE)
- Sub-routers with the `use()` method
- Automatic 404 and 405 responses

**Example Pattern:**
```typescript
const router = new Router("/api/club");
router.use("/:clubId<\\d+>/list", validClubId, listRouter);
router.get("/:clubId<\\d+>", validClubId, async ({ clubId }, res) => {
  // handler code
  return res(ok(JSON.stringify(result)));
});
```

**API Structure:**
- `/api/club/*` - All club-related endpoints
  - `/:clubId/list` - Watchlist/backlog management
  - `/:clubId/reviews` - Movie reviews
  - `/:clubId/members` - Club membership
  - `/:clubId/awards` - Awards system
  - `/:clubId/invite` - Invite management
  - `/:clubId/settings` - Club settings
  - `/join` - Join club endpoints

**Key Backend Patterns:**
- Repository pattern (e.g., `ClubRepository`, `UserRepository`, `WorkRepository`)
- Middleware for authentication (`loggedIn`, `secured`) and validation (`validClubId`)
- Zod schemas for request validation
- Kysely for type-safe database queries

### Database Architecture

**ORM:** Kysely with CockroachDB dialect (PostgreSQL-compatible)

**Connection:**
- Singleton instance in `netlify/functions/utils/database.ts`
- Connection string from `process.env.DATABASE_URL`

**Generated Types:**
- `lib/types/generated/db.ts` - Auto-generated by kysely-codegen
- Contains table schemas, enums (e.g., `WorkListType`, `WorkType`), and type helpers

**Key Tables:**
- `club` - Movie clubs
- `club_member` - Club membership with roles
- `club_invite` - Invite tokens with expiration
- `club_settings` - Key-value settings storage (JSON)
- `user` - User profiles
- `movie_details` - Cached movie metadata from TMDB
- `work_list` - Generic list for reviews, watchlist, backlog, awards
- `review` - Movie reviews with scores
- Various movie metadata junction tables (genres, production companies, countries)

**Migration System:**
- Uses Kysely Migrator
- Schema migrations in `migrations/schema/`
- Data migrations in `migrations/data/`
- Each migration exports `up()` and optionally `down()` functions

### Authentication Flow

1. BetterAuth client (`better-auth/vue`) initializes on app load
2. Auth store (Pinia) manages user state and session
3. Sessions managed via HTTP-only cookies (automatic by BetterAuth)
4. Router guards check auth before accessing protected routes
5. Backend functions use `loggedIn` or `secured` middleware to extract session
6. Email verification required before first login

## Common Patterns

### Feature Module Structure
```
src/features/<feature-name>/
  ├── views/            # Page-level components
  ├── components/       # Feature-specific components
  ├── composables/      # Vue composables (if needed)
  ├── tests/            # Feature tests (if any)
  └── constants.ts      # Feature constants (if needed)
```

### Adding a New API Endpoint
1. Create handler in appropriate `netlify/functions/` directory
2. Use the custom Router class for routing
3. Add middleware for validation and auth
4. Use Kysely with generated types for database queries
5. Return responses using utility functions from `utils/responses.ts`

### Adding a Database Table
1. Create migration in `migrations/schema/` with ISO date prefix
2. Run `npm run migrate:dev` to apply migration
3. Run `npm run codegen` to regenerate TypeScript types
4. Create repository class for data access (optional but recommended)

### Testing
- Test files use Vitest with jsdom environment
- Setup file: `src/tests/setup.ts`
- Mock Service Worker (MSW) for API mocking: `src/mocks/handlers.ts`
- Helper utilities in `src/tests/utils.ts`

## Key Files

- `src/main.ts` - Vue app initialization, global components, plugins
- `src/router/index.ts` - Route definitions and navigation guards
- `src/stores/auth.ts` - Authentication state and session management
- `src/lib/auth-client.ts` - BetterAuth client configuration
- `netlify/functions/utils/router.ts` - Custom routing framework
- `netlify/functions/utils/database.ts` - Database connection singleton
- `netlify/functions/utils/auth.ts` - Auth middleware
- `lib/types/generated/db.ts` - Auto-generated database types
- `migrations/schemaMigrator.ts` - Migration runner
- `vite.config.ts` - Vite and Vitest configuration
- `netlify.toml` - Netlify redirects (API proxy and SPA fallback)

## External Services

- **TMDB (The Movie Database)** - Movie metadata API (see `netlify/functions/utils/tmdb.ts`)
- **BetterAuth** - Authentication library (email/password with session management)
- **CockroachDB** - PostgreSQL-compatible distributed database
- **Cloudinary** - Image hosting (imported but usage not shown in sampled files)
