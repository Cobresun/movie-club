---
paths:
  - "netlify/**"
---

# Backend Architecture (Netlify Functions)

## Custom router

`netlify/functions/utils/router.ts` is a hand-rolled, type-safe Express-like router — middleware chaining _with type transformations_, path params via `path-parser`, sub-routers through `use()`, automatic 404/405. Middleware widens the handler's first argument, so a route mounted behind `validClubSlug` receives `clubSlug` already resolved and typed:

```typescript
router.use("/:clubSlug/list", validClubSlug, listRouter);
router.get("/:clubSlug", validClubSlug, async ({ clubSlug }, res) =>
  res(ok(JSON.stringify(await ClubRepository.getBySlug(clubSlug)))),
);
```

Routers are mounted from `netlify/functions/club/index.ts` and `member.ts` — read those for the current route surface rather than relying on a list here.

## Request pipeline

A handler is normally middleware + Zod body schema + repository + a helper from `utils/responses.ts` (`ok`, `badRequest`, `unauthorized`, `notFound`, `svg`, `redirect`).

- `loggedIn` — any authenticated user. `secured` — authenticated _and_ a member of the resolved club.
- `validClubSlug` resolves `:clubSlug`. `validListId` loads `:listId`, asserts it belongs to that club, and exposes `listSystemType` so handlers can gate operations on system lists.

## Lists

Lists are arbitrary and user-titled, keyed by UUID. A club's _reviews_ list is a system list (`system_type = 'reviews'`) and is deliberately filtered out of the list-collection endpoint, fetched instead through a dedicated reviews-id route and a richer reviews shape. Rename and delete are rejected for system lists.

`ListRepository.moveItem` is transactional with `ON CONFLICT DO NOTHING`, so moving into the reviews list and moving between user lists share one code path.

## Data access

Repository classes in `netlify/functions/repositories/` own all queries — one per aggregate, named `<Thing>Repository`. Kysely with generated types throughout.

Stale-metadata refresh is deliberately _not_ a repository: each `MediaProvider` in `netlify/functions/utils/providers/` implements `refreshStaleDetails(limit)` for its own source (TMDB, Google Books), and `scheduled-work-refresh.ts` sweeps them. `scheduled-db-cleanup.ts` reaps stale preview databases.

Deploy-time behavior lives in Netlify plugins: `netlify/plugins/preview-database/` (per-PR database selection, plus the shared-`dev` migration sync on production deploys) and `netlify/plugins/auth-config/`.

## Auth

`netlify/functions/utils/auth.ts` is the BetterAuth server config — bcrypt hashing, Google OAuth, Resend emails, and a mixed ID strategy (auto-increment for users, UUIDs for sessions). See the `better-auth-best-practices` skill for general patterns.

**Set-Cookie gotcha:** `Headers.forEach` folds repeated `Set-Cookie` values into one malformed header. Use `getSetCookie()` and return them via Netlify's `multiValueHeaders`.
