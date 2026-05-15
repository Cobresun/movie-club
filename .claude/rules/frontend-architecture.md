---
paths:
  - "src/**"
---

# Frontend Architecture (Vue 3 + Vite)

## Project Structure

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

## Key Technologies

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

## Global Components

Registered in `src/main.ts`: `v-avatar`, `v-backdrop`, `v-btn`, `v-select`, `v-switch`, `loading-spinner`, `movie-table`, `menu-card`, `v-modal`, `page-header`, `empty-state`

## Custom Directives

- `v-lazy-load` - Intersection Observer-based lazy loading for images

## Path Alias

- `@/*` maps to `src/*`

## Router Architecture

- Routes use a `depth` meta property for slide-in/slide-out transitions
- `checkClubAccess` guard ensures users are club members before accessing club routes
- Route transitions use animate.css classes (`animate__slideInRight`, `animate__slideInLeft`, etc.)
- Routes with `noAuth: true` meta are accessible without authentication
- Routes with `authRequired: true` meta redirect to Clubs page if not logged in

## Service Layer

Located in `src/service/`, these composables provide TanStack Query hooks for data fetching:

- `useClub.ts` - Club CRUD, membership, invites, settings
- `useReviews.ts` - Review management and scoring
- `useList.ts` - Arbitrary user-list CRUD (`useClubLists`, `useList(slug, listIdRef)`, `useCreateList`, `useRenameList`, `useDeleteList`, `useAddListItem`, `useDeleteListItem`, `useReorderList`, `useMoveListItem`) plus reviews-list helpers (`useReviewsList`, `useDeleteReview`, `useAddToReviewsList`, `useQueueReview`, `useUpdateReviewAddedDate`, `useAllUserListItems`). `useList` accepts a `MaybeRef<string>` so the active list ID can be reactive.
- `useAwards.ts` - Awards system data
- `useUser.ts` - User profile and clubs
- `useTMDB.ts` - TMDB movie search integration

See `tanstack-query-vue` skill for query key conventions, mutation patterns, caching config, and optimistic update strategies.

## Authentication (Frontend)

Auth store (Pinia) manages user state via `authClient.useSession()`. Router guards check auth before accessing protected routes.

- `src/lib/auth-client.ts` — BetterAuth Vue client
- `src/stores/auth.ts` — Authentication state and session management

## Key Frontend Files

- `src/main.ts` - Vue app initialization, global components, plugins
- `src/App.vue` - Root component with router view and transitions
- `src/router/index.ts` - Route definitions and navigation guards
- `vite.config.ts` - Vite and Vitest configuration
- `tailwind.config.cjs` - Tailwind CSS configuration
