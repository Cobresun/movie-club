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

## UI conventions

These are the nits that come back every review; none of them are negotiable in a PR.

- **Use the globally registered components.** `v-btn`, `v-modal`, `page-header` and friends exist — a hand-rolled `<button class="...">` in a view is a review comment. Check `src/main.ts` first.
- **Icons are `<mdicon>`, not characters.** `▶`, `▼`, `×`, `…` typed into a template get replaced with the registered icon (and `…` where an ellipsis genuinely is text, not three periods).
- **Tailwind utilities, not inline or arbitrary CSS.** If a sibling component expresses the same thing with a utility (`aspect-[2/3]` over a hand-written `padding-top` ratio), match the sibling.
- **No Tailwind class-list variables.** Assigning a string of classes to a `const` and binding it is treated as an anti-pattern here: inline the classes at both call sites, or, if they genuinely must stay in sync, extract a component.
- **Charts go through `VChart`**, not `<ag-charts>` directly. It closes the tooltip when the page scrolls — one opened by tapping a series otherwise stays up until the whole chart has left the viewport.
- **Poster grids use `grid grid-cols-auto`** with `justify-items-center gap-4`, the way `ListItems.vue`, `SharedListView.vue` and the awards views do. Don't invent a breakpoint set — changing grid sizing has broken the watch-list desktop layout before.
- **Template above script in every SFC.** Every component in the codebase is ordered that way.
- **Match the sibling.** Most of the above collapses into one habit: before writing a component, open the one next to it and do what it does.

## Accessibility is a functional requirement

Every element a user can act on needs a role and an accessible name — a real `<button>` rather than a `<div @click>`, an `aria-label` on an icon-only control, `alt` on a poster image, `aria-pressed` on a toggle, and a state that is conveyed by something other than colour alone. Content hidden behind a spoiler blur must be hidden from screen readers, not merely blurred.

The test suite is how this gets enforced — a spec that cannot find an element without a CSS selector has found a real bug (see `testing.md`). Reviews here have turned up keyboard-unreachable poster cards, unnamed chevron buttons, an inaccessible loading state and a spoiler read out in full. Fix the component; do not reach for a selector or a `data-testid`.

## Router

- Routes carry a `depth` meta. `App.vue` has a single `<transition name="route">`; the router compares depths and writes the direction to `document.documentElement.dataset.routeTransition`, and `tailwind.css` selects the animation with `html[data-route-transition="..."] .route-enter-active` rules.
- That indirection is deliberate: a dynamic `:name` on `<transition>` **cannot** change the _leave_ classes, because Vue resolves them before the name updates. Drive variants from the html data attribute, not the name.
- `checkClubAccess` guards club-scoped routes on membership. `noAuth: true` opts a route out of auth; `authRequired: true` redirects to Clubs when logged out.

## Service layer

`src/service/use<Feature>.ts` wraps every API call in TanStack Query hooks — components should not fetch directly. Several accept `MaybeRef` so IDs can be reactive (e.g. `useList(slug, listIdRef)`).

See the `tanstack-query-vue` skill for query-key conventions, mutation patterns, caching config, and optimistic updates.

**Mutations that change something on screen get an optimistic update.** Creating a list, renaming one, reordering, moving an item — waiting for the round trip reads as broken, and "it'll be there after the refetch" is not accepted in review. Two things to get right:

- **Update both ends of a move.** Removing from the source list and letting the destination wait for the refetch is a half-done optimistic update.
- **When the real id only exists after the response** (a freshly created list), keep the pending item visibly pending rather than letting the user reorder something that has no id yet.

**Don't paper over freshness with `staleTime`.** Scores, lists, comments and awards are collaborative — several people change them while another is looking at the page, and a user who hits refresh expects to see it. `src/main.ts` deliberately drives revalidation from a per-session fetch counter rather than a fixed `staleTime`, so a hard refresh revalidates while navigation within the session stays quiet; a blanket `staleTime` cannot tell those two apart. Read the comment there before changing the query defaults. `staleTime: Infinity` on immutable per-id data (TMDB details, generated discussion questions) is the exception, not the pattern.

**Validate in the client to the same limits the server enforces.** When a route rejects a comment over a length limit, the composer shows the limit and the counter — a silent 400 is a bug. Use Zod for that validation rather than hand-rolled checks, including for anything read back out of `localStorage`.

## Adding a feature

Create `src/features/<name>/` with a `views/` subdirectory, add a `src/service/use<Feature>.ts` for its API calls, then register routes in `src/router/index.ts` with a `depth` meta and `beforeEnter: checkClubAccess` if club-scoped.
