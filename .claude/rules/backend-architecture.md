---
paths:
  - "netlify/**"
---

# Backend Architecture (Netlify Functions)

## Custom Router System

Located in `netlify/functions/utils/router.ts`. A type-safe Express-like router supporting middleware chaining with type transformations, path parameter extraction via `path-parser`, method routing (GET, POST, PUT, DELETE), sub-routers with `use()`, and automatic 404/405 responses.

```typescript
const router = new Router("/api/club");
router.use("/:clubSlug/list", validClubSlug, listRouter);
router.get("/:clubSlug", validClubSlug, async ({ clubSlug }, res) => {
  const club = await ClubRepository.getBySlug(clubSlug);
  return res(ok(JSON.stringify(result)));
});
```

## API Structure

- `/api/og-image` - Open Graph image generation for shared reviews
- `/api/auth/*` - BetterAuth endpoints (handled automatically)
- `/api/club/*` - All club-related endpoints
  - `/:clubSlug/list` - Watchlist/backlog management
    - `PUT /:type/reorder` - Reorder list items
    - `PUT /:type/:workId/added-date` - Update item added date
  - `/:clubSlug/reviews` - Movie reviews
    - `GET /:workId/shared` - Shared review data for external sharing
    - `GET /:workId/comments` - Get comments for a work
    - `POST /:workId/comments` - Add comment to a work
    - `PUT /:workId/comments/:commentId` - Update a comment
    - `DELETE /:workId/comments/:commentId` - Delete a comment
  - `/:clubSlug/members` - Club membership
  - `/:clubSlug/awards` - Awards system (categories, nominations, rankings)
  - `/:clubSlug/invite` - Invite token management
  - `/:clubSlug/settings` - Club settings
  - `/:clubSlug/nextWork` - Current movie being watched
  - `/:clubSlug/name` - Update club name (PUT)
  - `/:clubSlug/slug` - Update club slug (PUT)
  - `/join` - Join club via invite
  - `/joinInfo/:token` - Get club info from invite token
- `/api/member/*` - User-specific endpoints
  - `/clubs` - Get user's clubs
  - `POST /avatar` - Upload avatar
  - `DELETE /avatar` - Delete avatar
  - `PUT /name` - Update user name

## Key Backend Patterns

- Repository pattern for data access (e.g., `ClubRepository`, `UserRepository`, `WorkRepository`)
- Middleware for authentication (`loggedIn`, `secured`) and validation (`validClubSlug`)
- Zod schemas for request body validation
- Kysely for type-safe database queries
- Response helpers from `utils/responses.ts` (`ok`, `badRequest`, `unauthorized`, `notFound`, `svg`, `redirect`)

## Repository Classes

Located in `netlify/functions/repositories/`:

- `ClubRepository` - Club CRUD, membership checks, invites
- `UserRepository` - User lookup and management
- `WorkRepository` - Movie/work management
- `ListRepository` - List operations (reviews, watchlist, backlog)
- `ReviewRepository` - Review data access
- `AwardsRepository` - Awards system data
- `SettingsRepository` - Club settings storage
- `ImageRepository` - Cloudinary image management
- `DatabaseCleanupRepository` - Preview database lifecycle management
- `MovieRefreshRepository` - Movie data refresh operations
- `WorkCommentRepository` - Work comment CRUD

## Scheduled Functions

- `netlify/functions/scheduled-db-cleanup.ts` - Daily cleanup of stale preview databases
- `netlify/functions/scheduled-movie-refresh.ts` - Scheduled movie data refresh

## Edge Functions

- `netlify/edge-functions/shared-review.ts` - Edge function for shared review pages (`/share/club/:clubSlug/review/:workId`)

## Netlify Plugins

- `netlify/plugins/preview-database/` - Preview database management for deploy previews
- `netlify/plugins/auth-config/` - Authentication configuration for deploys

## Authentication (Backend)

Backend uses `loggedIn` (any authenticated user) and `secured` (authenticated + club member) middleware. See `better-auth-best-practices` skill for general BetterAuth patterns.

- `netlify/functions/utils/auth.ts` — BetterAuth server config (bcrypt hashing, Google OAuth, Resend emails, mixed ID generation: auto-increment for users, UUIDs for sessions)

## Key Backend Files

- `netlify/functions/club/index.ts` - Main club API router
- `netlify/functions/auth.ts` - BetterAuth handler
- `netlify/functions/member.ts` - Member API endpoints
- `netlify/functions/utils/router.ts` - Custom routing framework
- `netlify/functions/utils/database.ts` - Database connection singleton
- `netlify/functions/utils/auth.ts` - Auth configuration and middleware
- `netlify/functions/utils/responses.ts` - HTTP response helpers
- `netlify/functions/utils/validation.ts` - Request validation middleware
- `netlify/functions/utils/slug.ts` - Slug generation and validation
- `netlify/functions/utils/email.ts` - Resend email templates
- `netlify/functions/utils/workDetailsMapper.ts` - Work-to-external-data mapper
- `netlify/functions/utils/movieDetailsUpdater.ts` - Movie details update utility
- `netlify/functions/og-image.ts` - Open Graph image generation
- `netlify/functions/services/SharedReviewService.ts` - Shared review data service
- `lib/types/*.ts` - Shared type definitions (club, movie, reviews, awards, lists, common, watchlist, etc.)
