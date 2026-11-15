---
paths:
  - "src/**"
---

# Frontend (Vue 3 + Vite)

`src/features/<feature>/` holds one domain's views, components and composables. `src/common/` is shared UI. `src/service/` holds the TanStack Query hooks every feature fetches through. A new feature gets a `views/` folder, a `src/service/use<Feature>.ts`, and routes in `src/router/index.ts` (`beforeEnter: checkClubAccess` if club-scoped).

## UI conventions

Before writing a component, open the one next to it and do what it does.

- **No Tailwind class-list variables.** Write classes on the element. If the same list must stay in sync across places, extract a component.
- **Use the globally registered components** (`v-btn`, `v-modal`, `page-header`; see `src/main.ts`), not a hand-rolled `<button class="…">`.
- **Dropdowns, listboxes and menus use `@headlessui/vue`** (`ClubSwitcher.vue`, `AddedByListbox.vue`), which supplies focus handling, Escape, outside-click and ARIA roles.
- **Icons are `<mdicon>`**, not characters like `▶` or `×`. Only icons registered in `src/icons.ts` exist; an unregistered name silently renders an alert triangle. `icons.test.ts` scans literal names in templates only, so register computed names and default props by hand.
- **Tailwind utilities, not inline or arbitrary CSS.**
- **Charts go through `VChart`**, which closes the tooltip on scroll.
- **Poster grids are `grid grid-cols-auto justify-items-center gap-4`.** Don't invent a breakpoint set.
- **Teleport overlays out of animated content.** A `transform` (`animate-fade-up`) becomes the containing block for `position: fixed` descendants, so a modal inside it covers that element instead of the screen. Wrap it in `<Teleport to="body">`.
- **Template above script** in every SFC. Older files that open with `<script>` are not the convention.
- **Counts read correctly at one** ("1 hour"). Join variable-length lists with `Intl.ListFormat`.

## Accessibility

Every element a user can act on has a role and an accessible name. Specs query by role, so a missing one fails the test (`testing.md`).

- A real `<button>`, not `<div @click>`. `aria-label` on icon-only controls, `alt` on posters, `aria-pressed` on toggles. State is never conveyed by colour alone.
- A transient icon swap (the tick after copy) changes the control's `aria-label` too, on every path that succeeds, including fallbacks.
- Spoiler-blurred content is `aria-hidden`, and must not leak through an `aria-label`, a `title` or an aggregate built from blurred values.
- A hand-built popup closes on blur and Escape (without clearing what was typed) and selects on `click` as well as `mousedown`.

## Router

- Page transitions are one crossfade from `router/viewTransitions.ts` (View Transitions API). Don't add per-route or directional animations: a `transform` on a page wrapper re-anchors every `position: fixed` descendant.
- `checkClubAccess` guards club routes. `noAuth: true` opts a route out of auth; `authRequired: true` redirects to Clubs when logged out.
- Guards answer from the cache without waiting for a refetch. A mutation that changes membership or a slug must write the clubs cache before navigating (`useClub.ts`).

## Service layer

Components never fetch directly. Response types come from `lib/types/`, the same ones the handler passes to `ok<T>()`. See the `tanstack-query-vue` skill for keys and mutation patterns.

- **Hook arguments are reactive.** Take ids as `MaybeRefOrGetter<T>` and read them with `toValue` inside a `computed` query key (`useDailyGamePuzzle`). A plain string is captured once, and a reused router view keeps showing the first value.
- **Mutations that change the screen update optimistically.**
  - `await queryClient.cancelQueries(…)` for every key `onMutate` writes, or an in-flight refetch snaps the screen back.
  - Update both ends of a move.
  - Keep an item whose real id arrives with the response visibly pending.
  - Close the modal or navigate when the user acts, not in `onSuccess`. Failures come back as a toast.
  - Write what the response already told you into the cache, then invalidate in the background.
- **Don't add `staleTime` for freshness.** Scores, lists, comments and awards are collaborative. `src/main.ts` revalidates by a per-session fetch counter so a hard refresh refetches; read its comment before changing defaults. `staleTime: Infinity` is for immutable per-id data only.
- **Validate in the client to the server's limits**, with Zod, including anything read from `localStorage`. A silent 400 is a bug.
