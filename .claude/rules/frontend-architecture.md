---
paths:
  - "src/**"
---

# Frontend Architecture (Vue 3 + Vite)

Feature-based layout: `src/features/<feature>/` holds views, components, and composables for one domain; `src/common/` holds shared UI and utilities; `src/service/` holds the TanStack Query composables every feature fetches through. `@/*` aliases `src/*`.

A handful of components are registered globally in `src/main.ts` (`v-btn`, `v-modal`, `page-header`, …) — they appear in templates with no import, so check there before assuming a tag is undefined.

## Icons (mdi-vue): the silent-failure trap

Icons are referenced by kebab-case name (`<mdicon name="movie-open-outline">`), but **only icons registered in `src/icons.ts` exist** — that file imports a curated set of `mdiPascalCase` paths from `@mdi/js` so the bundler can tree-shake the other ~7,000. An unregistered name doesn't error; mdi-vue silently renders an `mdiAlert` triangle.

So: when you add or change an icon name, register the matching `mdiPascalCase` export in `src/icons.ts` (import + the `icons` object, alphabetized).

`icons.test.ts` enforces this, but its scan is **static** — it only sees literal names in `.vue` templates (`name="..."` and ternary literals). Names produced by a function or computed are invisible to it:

- Names from `CLUB_TYPE_CONFIG` (`src/common/clubType.ts`) are covered by a dedicated registry test in `icons.test.ts`. A new club type needs its `icon` there **and** in `src/icons.ts`.
- Any other computed/ref name (`copyIcon`, default `fallback-icon` props) is covered by nothing. Register those by hand.

## Router

- Routes carry a `depth` meta. `App.vue` has a single `<transition name="route">`; the router compares depths and writes the direction to `document.documentElement.dataset.routeTransition`, and `tailwind.css` selects the animation with `html[data-route-transition="..."] .route-enter-active` rules.
- That indirection is deliberate: a dynamic `:name` on `<transition>` **cannot** change the _leave_ classes, because Vue resolves them before the name updates. Drive variants from the html data attribute, not the name.
- `checkClubAccess` guards club-scoped routes on membership. `noAuth: true` opts a route out of auth; `authRequired: true` redirects to Clubs when logged out.

## Service layer

`src/service/use<Feature>.ts` wraps every API call in TanStack Query hooks — components should not fetch directly. Several accept `MaybeRef` so IDs can be reactive (e.g. `useList(slug, listIdRef)`).

See the `tanstack-query-vue` skill for query-key conventions, mutation patterns, caching config, and optimistic updates.

## Adding a feature

Create `src/features/<name>/` with a `views/` subdirectory, add a `src/service/use<Feature>.ts` for its API calls, then register routes in `src/router/index.ts` with a `depth` meta and `beforeEnter: checkClubAccess` if club-scoped.
