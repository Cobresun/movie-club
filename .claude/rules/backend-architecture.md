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

**Bodies go through `parseBody(event, schema, res)`** (`utils/parseBody.ts`) with a Zod schema — it handles missing body, malformed JSON, and schema failure as one 400 each. A cast (`event.body as CreateListDto`) is not validation; it is the bug. This applies to handlers you are only passing through: converting a cast you happened to touch is in scope, not scope creep.

## Authorization and tenancy

`secured` proves the caller is a member of _this_ club. It says nothing about whether the row they are mutating is theirs. Two rules on top of it:

**Check ownership on every mutation of a user-owned row**, and return `unauthorized(...)` when it fails. Comment edit/delete, review score delete — each one needs its own check; membership is not permission to edit someone else's data.

**Repository methods that touch club-scoped rows take `clubId` and filter on it.** Scope the query so cross-tenant data cannot come back, rather than resolving an id in one layer and trusting the next layer to have checked. Pushing the guard up to the caller and documenting the requirement is the pattern that gets rejected in review — if a check is a valid concern, it belongs in the method that runs the query.

```typescript
// The id alone would happily read another club's list.
async getListById(listId: string, clubId: string) { … .where("club_id", "=", clubId) }
```

**Derive from ids; do not trust the client for anything the server already knows.** A body that carries `title` and `releaseYear` alongside `workId` is both redundant and an injection vector — the discussion-question prompt is built from those fields, so a client could write the prompt. Take the id, look the rest up. The frontend service should not be sending the derivable fields either.

## Keep shared utilities type-agnostic

Generic infrastructure stays generic. `utils/gemini.ts` is an LLM interface, not the discussion-questions feature: prompts belong to the `MediaProvider` that knows what a movie or a book is. Likewise a query in `WorkRepository` should not branch on `WorkType` — that query grows an arm every time a club type is added. Push the type-specific half into the provider and keep the repository query one shape.

This is the backend face of the registry rule in `code-quality.md`; adding a club type should touch a registry and a provider, nothing else.

## Lists

Lists are arbitrary and user-titled, keyed by UUID. A club's _reviews_ list is a system list (`system_type = 'reviews'`) and is deliberately filtered out of the list-collection endpoint, fetched instead through a dedicated reviews-id route and a richer reviews shape. Rename and delete are rejected for system lists.

`ListRepository.moveItem` is transactional with `ON CONFLICT DO NOTHING`, so moving into the reviews list and moving between user lists share one code path.

## Data access

Repository classes in `netlify/functions/repositories/` own all queries — one per aggregate, named `<Thing>Repository`. Kysely with generated types throughout.

Stale-metadata refresh is deliberately _not_ a repository: each `MediaProvider` in `netlify/functions/utils/providers/` implements `refreshStaleDetails(limit)` for its own source (TMDB, Google Books), and `scheduled-work-refresh.ts` sweeps them. `scheduled-db-cleanup.ts` reaps stale preview databases, and `scheduled-metrics-snapshot.ts` records the observability rollups `MetricsRepository` reads.

Deploy-time behavior lives in Netlify plugins: `netlify/plugins/preview-database/` (per-PR database selection, plus the shared-`dev` migration sync on production deploys) and `netlify/plugins/auth-config/`.

## Auth

`netlify/functions/utils/auth.ts` is the BetterAuth server config — bcrypt hashing, Google OAuth, Resend emails, and a mixed ID strategy (auto-increment for users, UUIDs for sessions). See the `better-auth-best-practices` skill for general patterns.

**Set-Cookie gotcha:** `Headers.forEach` folds repeated `Set-Cookie` values into one malformed header. Use `getSetCookie()` and return them via Netlify's `multiValueHeaders`.
