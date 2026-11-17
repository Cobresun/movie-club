---
paths:
  - "netlify/**"
---

# Backend (Netlify Functions)

## Request pipeline

A handler is middleware, a Zod body schema, a repository call and a helper from `utils/responses.ts`. Routes use the typed router in `utils/router.ts`; middleware widens the handler's first argument. Read `club/index.ts`, `member.ts` and `member-avatar.ts` for the route surface.

- `loggedIn` is any authenticated user. `secured` is a member of the resolved club. `validClubSlug` resolves `:clubSlug`. `validListId` loads `:listId`, checks it belongs to the club, and exposes `listSystemType`.
- **Responses name their contract: `ok<T>(data)`**, where `T` is the `lib/types/` type the frontend service reads. The type argument is required. A shape the frontend reads belongs in `lib/types/`, not in a repository or `src/service/`.
- **Bodies go through `parseBody(event, schema, res)`.** A cast (`event.body as Dto`) is not validation. Convert a cast in a handler you are editing.
- An error thrown in a handler becomes a 500. Return `badRequest`, `notFound` or `unauthorized` for expected failures.
- **Keep each function's import graph to what its routes use.** Every import is evaluated on a cold start, so a heavy dependency that only a rare route needs gets a function of its own, redirected in `netlify.toml` above `/api/*` (the avatar routes are split from `member` so the clubs list doesn't load Cloudinary). Use static imports, not `import()` inside a route. Repositories don't import `utils/providers`, which loads every provider and its HTTP client; a handler that needs both calls the provider itself.

## Authorization

- **Check ownership on every mutation of a user-owned row** (comment edit, score delete) and return `unauthorized(…)`. `secured` proves club membership, not that the row is the caller's.
- **Repository methods on club-scoped rows take `clubId` and filter on it.** Scope the query itself; don't resolve an id in one layer and trust the next to have checked.
- **The acting user comes from the session** (`sessionUserId` in `utils/session.ts`, or `secured`), never from the body, including on endpoints anonymous callers can also use.
- **Take ids and look the rest up.** A body carrying `title` next to `workId` is redundant, and an injection vector wherever those fields reach a prompt.

## Keep shared code type-agnostic

The backend half of the registry rule in `code-quality.md`: adding a club type should touch a provider, nothing else.

- Repositories, route handlers and shared utilities never branch on club or work type, import a provider-specific type, or parse a provider's address format. `utils/gemini.ts` is an LLM interface; prompts belong to the provider.
- Reach a provider from the work: `getProvider(work.type)`. `providerForClub(clubType)` is only for cases with no work to ask (a new club's default list, a club type's daily game).
- A per-type constant is a field on `MediaProvider` (`defaultListTitle`). A per-type feature is an optional interface on it (`dailyGame`).
- Names that every club type passes through are media-agnostic: "work", not "movie".
- Stale-metadata refresh is per provider (`refreshStaleDetails`), swept by `scheduled-work-refresh.ts`. It is deliberately not a repository.

## Works, lists and reviews

The data model is in `database.md`.

- `POST /reviews` scores `workId`, or the child that `MediaProvider.resolveChild(parent, childExternalId)` resolves, upserted on its first score. An unresolvable child is a 400. There is no per-level score endpoint.
- Children are never `work_list_item` rows. Queries reach them through the parent's item.
- A review references its work and its list separately, so taking a work off a list deletes that list's reviews of it and its children explicitly (`ListRepository`). Nothing cascades from the item.
- The reviews list is a system list: excluded from the list-collection endpoint, and rename and delete are rejected.
- Reuse the generic list-item endpoints. Moving an item into the reviews list is the move endpoint with that list's id.
- The TV provider re-reads TMDB for an episode its cache lacks only when the cached listing is over 15 minutes old. A season TMDB 404s is refused, not a 500.

## Awards

- A club's awards year is one JSON document in `awards_temp`, rewritten through `AwardsRepository.updateByYear` under `SELECT … FOR UPDATE`.
- For anything the current state forbids, return `reject(message)` from the updater (a 400). Throwing is a 500.
- Steps only move forward (`stepChangeError` in `lib/awards.ts`), and only once every member has finished the current one. Each write is gated on its phase.
- Rules the client also shows (limits, scoring) live in `lib/awards.ts`.

## Daily game

- One handler and one pair of tables keyed by `work_type` serve every club type. What varies is the provider's `dailyGame`. The scoring core is in `lib/`, shared with Score Assist.
- **Netlify runs scheduled functions only on the production deploy**, never on previews or `netlify dev`, so the endpoint seeds a too-small catalog itself.
- Only a date that is somebody's today draws an answer or records a result. An earlier date serves its recorded answer or a 404. The archive listing never includes answers.
- The server decides whether the posted guesses solved the puzzle. Results are one per player per day, keyed by a browser id plus the session's user id when signed in.

## External calls and aggregates

- A loop over an external API runs in bounded batches with `Promise.allSettled` and logs failures (`utils/dailyGame.ts`).
- A response identical for every caller sets `Netlify-CDN-Cache-Control` (`CDN_CACHE_CONTROL` in `daily-game.ts`).
- A date in a path is `z.string().date()` (`puzzleDateSchema`). A regex or `new Date()` accepts `2026-02-31`.
- Summary tiles use the same key and date range as the table under them. Never silently cap a listed result.

## Auth

`utils/auth.ts` is the BetterAuth config behind `/api/auth/*`; see the `better-auth-best-practices` skill. Every other function checks sessions through `utils/session.ts` (`sessionUserId`, `loggedIn`, `secured`, `siteAdmin`), a second instance without hashing, OAuth, email or signup hooks, so their cold starts don't load them. What both must agree on to read each other's cookies (base URL, database, session and cookie cache, ID strategy) lives in `utils/authOptions.ts`.

- **Set-Cookie:** `Headers.forEach` folds repeated `Set-Cookie` values into one malformed header. Use `getSetCookie()` and return them through `multiValueHeaders`.
- **Only the auth endpoint renews sessions.** `loggedIn` reads with `disableRefresh`, because `getSession` called from a handler has nowhere to send a Set-Cookie.
