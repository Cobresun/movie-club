# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Movie Club is a Vue 3 web application for managing movie clubs, reviews, watchlists, and awards. It uses Netlify Functions for the backend API, CockroachDB (PostgreSQL-compatible) for data storage, and BetterAuth for authentication.

## Code Quality

Code quality checks (`npm run type-check` and `npm run lint`) run automatically via Claude Code hooks after every file edit. Run `npm test` manually when changes affect tested code.

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

### Database Management

**Preview Databases & Isolated Development:**

The project uses CockroachDB's BACKUP/RESTORE with S3 to create isolated database environments for development and deploy previews. This prevents migration conflicts when multiple developers or PRs have schema changes.

**Snapshot Management:**

```bash
npm run db:snapshot         # Create backup snapshot of dev database to S3
npm run db:snapshot prod    # Snapshot production database
```

Snapshots are stored in `s3://movie-club-crdb-dev-exports` and should be created periodically (e.g., weekly) to keep spawned databases up-to-date. The script will warn when you have more than 5 snapshots.

**Spawning Development Databases:**

```bash
npm run db:spawn my-feature  # Create personal dev database from latest snapshot
```

This creates `dev_{username}_my-feature` by restoring from the latest S3 snapshot. Much faster than the old row-by-row copying approach (seconds vs. minutes).

**Database Utilities:**

```bash
npm run db:list              # List all databases with metadata
npm run db:cleanup my-feature  # Delete personal database when done
npm run db:cleanup --older-than 7  # Clean up databases older than 7 days
```

**Environment Variables Required:**

- `DATABASE_URL` - CockroachDB connection string
- `AWS_ACCESS_KEY_COCKROACH_BACKUP` - AWS access key for S3 backups
- `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP` - AWS secret key for S3 backups

**When to Use:**

- Working on schema migrations that conflict with others
- Testing migrations in isolation
- Need a clean database state from a known snapshot
- Deploy previews with migrations (automated by Netlify plugin)

See `PREVIEW_DATABASES.md` for complete documentation.

## Architecture

### Frontend Architecture (Vue 3 + Vite)

**Project Structure:**

- `src/features/` - Feature-based modules containing views, components, and composables
  - `auth/` - Authentication views (verify email, password reset)
  - `awards/` - Awards system with nominations, rankings, and results
  - `clubs/` - Club listing and creation
  - `profile/` - User profile management
  - `reviews/` - Movie reviews with gallery and table views
  - `settings/` - Club settings and member management
  - `statistics/` - Club statistics and charts
  - `watch-list/` - Watchlist and backlog management
- `src/common/` - Shared components and utilities
  - `components/` - Reusable UI components (VBtn, VModal, VSelect, etc.)
  - `composables/` - Shared Vue composables
  - `errorCodes.ts` - Error code definitions
- `src/service/` - TanStack Query composables for data fetching
- `src/stores/` - Pinia stores (currently `auth.ts`)
- `src/router/` - Vue Router configuration with auth guards
- `src/lib/` - Library code (auth client)
- `src/directives/` - Custom Vue directives (LazyLoad)
- `src/mocks/` - MSW handlers and test data

**Key Technologies:**

- **Vue 3** with Composition API and `<script setup>`
- **Vite** for build tooling
- **TypeScript** with strict mode
- **Pinia** for state management
- **Vue Router 4** with route-based code splitting
- **TanStack Query (Vue Query)** for server state management with persistence
- **BetterAuth** (better-auth/vue) for authentication with email/password and Google OAuth
- **Tailwind CSS** for styling
- **Vitest** for testing with jsdom environment
- **mdi-vue** for Material Design Icons
- **vue-toastification** for toast notifications
- **AG Charts** for statistics visualizations
- **Headless UI** for accessible UI primitives

**Global Components:**
Registered in `src/main.ts`: `v-avatar`, `v-btn`, `v-select`, `v-switch`, `loading-spinner`, `movie-table`, `menu-card`, `v-modal`, `page-header`

**Custom Directives:**

- `v-lazy-load` - Intersection Observer-based lazy loading for images

**Path Alias:**

- `@/*` maps to `src/*`

**Router Architecture:**

- Routes use a `depth` meta property for slide-in/slide-out transitions
- `checkClubAccess` guard ensures users are club members before accessing club routes
- Route transitions use animate.css classes (`animate__slideInRight`, `animate__slideInLeft`, etc.)
- Routes with `noAuth: true` meta are accessible without authentication
- Routes with `authRequired: true` meta redirect to Clubs page if not logged in

**Query Caching:**

- Vue Query persists to localStorage with 1-week cache time
- Custom refetch logic limits remounts to avoid excessive refetching
- User query data is never persisted (excluded via `shouldDehydrateQuery`)

### Service Layer

Located in `src/service/`, these composables provide TanStack Query hooks for data fetching:

- `useClub.ts` - Club CRUD, membership, invites, settings
- `useReviews.ts` - Review management and scoring
- `useList.ts` - Watchlist/backlog operations
- `useAwards.ts` - Awards system data
- `useUser.ts` - User profile and clubs
- `useTMDB.ts` - TMDB movie search integration

**Example Pattern:**

```typescript
export function useClub(clubId: string) {
  return useQuery<ClubPreview>({
    queryKey: ["club", clubId],
    queryFn: async () => await fetchClub(clubId),
  });
}

export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clubName, members }) =>
      axios.post(`/api/club`, { name: clubName, members }),
    onSuccess: () => {
      queryClient.invalidateQueries(["user", "clubs"]);
    },
  });
}
```

### Backend Architecture (Netlify Functions)

**Custom Router System:**
Located in `netlify/functions/utils/router.ts`. A type-safe Express-like router implementation that supports:

- Middleware chaining with type transformations
- Path parameter extraction using `path-parser` (e.g., `/:clubId<\\d+>`)
- Method routing (GET, POST, PUT, DELETE)
- Sub-routers with the `use()` method
- Automatic 404 and 405 responses

**Example Pattern:**

```typescript
const router = new Router("/api/club");
router.use("/:clubId<\\d+>/list", validClubId, listRouter);
router.get("/:clubId<\\d+>", validClubId, async ({ clubId }, res) => {
  const club = await ClubRepository.getById(clubId);
  return res(ok(JSON.stringify(result)));
});
```

**API Structure:**

- `/api/auth/*` - BetterAuth endpoints (handled automatically)
- `/api/club/*` - All club-related endpoints
  - `/:clubId/list` - Watchlist/backlog management
  - `/:clubId/reviews` - Movie reviews
  - `/:clubId/members` - Club membership
  - `/:clubId/awards` - Awards system (categories, nominations, rankings)
  - `/:clubId/invite` - Invite token management
  - `/:clubId/settings` - Club settings
  - `/:clubId/nextWork` - Current movie being watched
  - `/join` - Join club via invite
  - `/joinInfo/:token` - Get club info from invite token
- `/api/member/*` - User-specific endpoints
  - `/clubs` - Get user's clubs

**Key Backend Patterns:**

- Repository pattern for data access (e.g., `ClubRepository`, `UserRepository`, `WorkRepository`)
- Middleware for authentication (`loggedIn`, `secured`) and validation (`validClubId`)
- Zod schemas for request body validation
- Kysely for type-safe database queries
- Response helpers from `utils/responses.ts` (`ok`, `badRequest`, `unauthorized`, `notFound`)

**Repository Classes:**
Located in `netlify/functions/repositories/`:

- `ClubRepository` - Club CRUD, membership checks, invites
- `UserRepository` - User lookup and management
- `WorkRepository` - Movie/work management
- `ListRepository` - List operations (reviews, watchlist, backlog)
- `ReviewRepository` - Review data access
- `AwardsRepository` - Awards system data
- `SettingsRepository` - Club settings storage
- `ImageRepository` - Cloudinary image management

### Database Architecture

**ORM:** Kysely with CockroachDB dialect (PostgreSQL-compatible)

**Connection:**

- Singleton instance in `netlify/functions/utils/database.ts`
- Connection string from `process.env.DATABASE_URL`
- Uses `@cubos/kysely-cockroach` for CockroachDB dialect

**Generated Types:**

- `lib/types/generated/db.ts` - Auto-generated by kysely-codegen
- Contains table interfaces, enums, and type helpers
- **Enums:** `WorkListType` (reviews, watchlist, backlog, award_nominations), `WorkType` (movie)
- **Key type helpers:** `Generated<T>`, `Int8`, `Timestamp`, `Json`

**Key Tables:**

- `club` - Movie clubs (id, name, legacy_id)
- `club_member` - Club membership with roles (club_id, user_id, role)
- `club_invite` - Invite tokens with expiration
- `club_settings` - Key-value settings storage (JSON values)
- `user` - User profiles (BetterAuth managed)
- `account` - OAuth accounts (BetterAuth managed)
- `session` - User sessions (BetterAuth managed)
- `verification` - Email verification tokens (BetterAuth managed)
- `movie_details` - Cached movie metadata from TMDB
- `work_list` - Generic list for reviews, watchlist, backlog, awards
- `review` - Movie reviews with scores
- `awards_temp` - Temporary awards data storage (JSON)
- Various movie metadata junction tables (genres, production companies, countries)

**Migration System:**

- Uses Kysely Migrator
- Schema migrations in `migrations/schema/`
- Data migrations in `migrations/data/`
- Each migration exports `up()` and optionally `down()` functions
- Naming convention: `<YYYYMMDD>_<Description>.ts`

### Authentication Flow

1. BetterAuth client (`better-auth/vue`) initializes on app load
2. Auth store (Pinia) manages user state via `authClient.useSession()` reactive hook
3. Sessions managed via HTTP-only cookies (automatic by BetterAuth)
4. Supports email/password authentication with email verification
5. Supports Google OAuth login
6. Router guards check auth before accessing protected routes
7. Backend functions use `loggedIn` or `secured` middleware to extract session from headers

**Auth Configuration:**

- Frontend: `src/lib/auth-client.ts` - Creates BetterAuth Vue client
- Backend: `netlify/functions/utils/auth.ts` - BetterAuth server config with:
  - Email/password with bcrypt hashing
  - Google OAuth provider
  - Resend for transactional emails
  - Mixed ID generation (auto-increment for users, UUIDs for sessions)

## Code Quality & Utilities

### Type Guards and Utility Functions

**Location:** `lib/checks/checks.ts`

This module provides utility functions for type-safe null/undefined checks and type guards. **Always use these instead of manual checks** to maintain consistency and satisfy ESLint's `@typescript-eslint/strict-boolean-expressions` rule.

**Key Functions:**

```typescript
// ✅ PREFERRED: Check if string has value (not null/undefined/empty)
import { hasValue } from "@/lib/checks/checks";

if (hasValue(myString)) {
  // TypeScript knows myString is string here
  console.log(myString.toUpperCase());
}

// ❌ AVOID: Manual checks that ESLint will flag
if (myString && myString.trim() !== "") {
}
if (typeof myString === "string" && myString.length > 0) {
}
```

**Available Utilities:**

- `hasValue(s: string | undefined | null): s is string` - Returns true if string is defined and not empty
- `isDefined<T>(value: T | null | undefined): value is T` - Returns true if not null/undefined
- `isString(s: unknown): s is string` - Type guard for strings
- `isTrue(b: unknown): b is true` - Type guard for true boolean
- `hasElements<T>(arr: ReadonlyArray<T> | null | undefined): arr is NonEmptyArray<T>` - Returns true if array is defined and non-empty
- `ensure<T>(val: T | undefined | null, message?: string): T` - Throws if value is null/undefined, otherwise returns the value
- `filterUndefinedProperties(obj: Record<string, string | undefined>): Record<string, string>` - Filters out undefined properties from an object

**When to Use Each:**

- Use `hasValue()` for **string checks** (most common)
- Use `isDefined()` for **object/number/boolean checks**
- Use `hasElements()` for **array checks**
- Use `ensure()` when you want to **throw on null/undefined** (guard clauses)

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
3. Add middleware for validation (`validClubId`) and auth (`loggedIn`, `secured`)
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

### Testing

- Test files use Vitest with jsdom environment
- Setup file: `src/tests/setup.ts`
- Mock Service Worker (MSW) for API mocking: `src/mocks/handlers.ts`
- Helper utilities in `src/tests/utils.ts`
- Test data in `src/mocks/data/`
- Coverage excludes mocks and test directories

## Key Files

**Frontend:**

- `src/main.ts` - Vue app initialization, global components, plugins
- `src/App.vue` - Root component with router view and transitions
- `src/router/index.ts` - Route definitions and navigation guards
- `src/stores/auth.ts` - Authentication state and session management
- `src/lib/auth-client.ts` - BetterAuth client configuration

**Backend:**

- `netlify/functions/club/index.ts` - Main club API router
- `netlify/functions/auth.ts` - BetterAuth handler
- `netlify/functions/member.ts` - Member API endpoints
- `netlify/functions/utils/router.ts` - Custom routing framework
- `netlify/functions/utils/database.ts` - Database connection singleton
- `netlify/functions/utils/auth.ts` - Auth configuration and middleware
- `netlify/functions/utils/responses.ts` - HTTP response helpers
- `netlify/functions/utils/validation.ts` - Request validation middleware

**Shared:**

- `lib/types/generated/db.ts` - Auto-generated database types
- `lib/types/*.ts` - Shared type definitions (club, movie, reviews, awards, etc.)
- `lib/checks/checks.ts` - Utility functions (isDefined, hasValue, ensure, etc.)

**Configuration:**

- `vite.config.ts` - Vite and Vitest configuration
- `netlify.toml` - Netlify redirects (API proxy and SPA fallback)
- `package.json` - Dependencies and scripts
- `tailwind.config.js` - Tailwind CSS configuration

## External Services

- **TMDB (The Movie Database)** - Movie metadata API (`netlify/functions/utils/tmdb.ts`)
- **BetterAuth** - Authentication library with email/password and OAuth support
- **CockroachDB** - PostgreSQL-compatible distributed database
- **Cloudinary** - Image hosting for profile photos (`netlify/functions/repositories/ImageRepository.ts`)
- **Resend** - Transactional email service for verification and password reset emails

## Environment Variables

Required environment variables (documented in Cobresun Notion):

- `DATABASE_URL` - CockroachDB connection string
- `AWS_ACCESS_KEY_COCKROACH_BACKUP` - AWS access key for S3 backups
- `AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP` - AWS secret key for S3 backups
- `BETTER_AUTH_URL` - Base URL for BetterAuth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `RESEND_API_KEY` - Resend email API key
- `CLOUDINARY_URL` - Cloudinary configuration URL
- `TMDB_API_KEY` - TMDB API key for movie data

Netlify provides automatically:

- `URL` - Production site URL
- `DEPLOY_PRIME_URL` - Deploy preview URL
