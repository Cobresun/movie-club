# Code Quality Rules

## Type Guards and Utility Functions

**Location:** `lib/checks/checks.ts`

Always use these utilities instead of manual null/undefined checks. They maintain consistency and satisfy ESLint's `@typescript-eslint/strict-boolean-expressions` rule.

```typescript
// PREFERRED: Check if string has value (not null/undefined/empty)
import { hasValue } from "@/lib/checks/checks";

if (hasValue(myString)) {
  // TypeScript knows myString is string here
  console.log(myString.toUpperCase());
}

// AVOID: Manual checks that ESLint will flag
if (myString && myString.trim() !== "") {}
if (typeof myString === "string" && myString.length > 0) {}
```

**Available Utilities:**

- `hasValue(s: string | undefined | null): s is string` - Returns true if string is defined and not empty
- `isDefined<T>(value: T | null | undefined): value is T` - Returns true if not null/undefined
- `isString(s: unknown): s is string` - Type guard for strings
- `isTrue(b: unknown): b is true` - Type guard for true boolean
- `hasElements<T>(arr: ReadonlyArray<T> | null | undefined): arr is NonEmptyArray<T>` - Returns true if array is defined and non-empty
- `ensure<T>(val: T | undefined | null, message?: string): T` - Throws if value is null/undefined, otherwise returns the value
- `filterUndefinedProperties(obj: Record<string, string | undefined>): Record<string, string>` - Filters out undefined properties

**When to Use Each:**

- `hasValue()` for **string checks** (most common)
- `isDefined()` for **object/number/boolean checks**
- `hasElements()` for **array checks**
- `ensure()` when you want to **throw on null/undefined** (guard clauses)

## Import Order

`eslint-plugin-import` is configured in `eslint.config.mjs` with two declared groups (`builtin+external` and `internal+parent+sibling+index`), but because no path resolver is wired up, `@/*` alias imports are not classified as `internal` and end up in their own de-facto third group. In practice, `<script setup>` imports should form three blocks separated by single blank lines, alphabetized case-insensitively within each:

```ts
import { computed, shallowRef } from "vue";            // 1. external

import { hasElements } from "../../../../lib/checks/checks";  // 2. relative parent/sibling
import AddMovieModal from "../components/AddMovieModal.vue";
import ListItems from "../components/ListItems.vue";

import { useClubSlug } from "@/service/useClub";       // 3. @/ alias
import { useClubLists } from "@/service/useList";
```

Blank lines within a group trigger `no empty line within import group`; missing blank lines between groups trigger `at least one empty line between import groups`. When adding a new import, slot it into the correct block in alphabetical position — do not append to the end. `npx eslint <file> --fix` handles this mechanically.

## Avoid `as` Type Casting

Never use `as` casts (especially `as unknown as T`) in tests or production code. These silence TypeScript without providing type safety and can mask real bugs. If a test requires casting to simulate an invalid state, that is a sign the test should be removed — our type system prevents that state from occurring.

```ts
// AVOID:
const input = [2, undefined as unknown as number, 6]; // masks a type violation

// PREFERRED: Only test states that TypeScript types actually permit.
```

## Avoid `watch()` - Prefer Keyed Components

Using `watch()` on query values is often a code smell. Instead, prefer higher-order components that pass data down as props and use the `:key` attribute to force re-renders when data changes.

```typescript
// AVOID: Using watch for query data
const { data: club } = useClub(clubSlug);
watch(club, (newClub) => {
  updateSomething(newClub);
});
```

```vue
<!-- PREFERRED: Keyed components that re-render -->
<template>
  <ClubDetails v-if="club" :key="club?.id" :club="club" />
</template>
```

When `club` data changes, Vue destroys and recreates `ClubDetails` with clean state. This makes data flow explicit, avoids timing issues with watchers, and reduces bugs from stale closures.

**When `watch()` is acceptable:**

- Syncing with external systems (localStorage, browser APIs)
- Triggering animations or side effects that are truly reactive in nature

## Club-Type Variation: Registry over Conditionals

Anything that varies by club type — copy, icons, labels, behavior, per-type data
construction — must be driven by a registry, never an inline `clubType === ...`
(or `review.type === ...`) branch. Adding a new club type should mean adding one
registry entry, not hunting down conditionals scattered across widgets and views.

```ts
// AVOID: inline enum ternary, one per component
const countLabel = computed(() =>
  props.clubType === ClubType.movie ? "movies watched" : "books read",
);

// PREFERRED: read it from the registry
const stats = computed(() => clubTypeStats(props.clubType));
const countLabel = computed(() => stats.value.countLabel);
```

Which registry depends on what the value depends on — there are two tiers:

1. **Cross-feature display/behavior → shared `CLUB_TYPE_CONFIG`** in
   `src/common/clubType.ts` (a `Record<ClubType, ClubTypeConfig>`). Add a field
   (or a sub-block like `stats`) and read it via a helper such as
   `clubTypeConfig(type)` / `clubTypeStats(type)`. Components take `clubType` as a
   prop and look it up.

2. **Feature-specific logic that depends on the feature's own types → a
   feature-local `Record<Enum, ...>`**, NOT `src/common`. Putting it in
   `clubType.ts` would make the shared service import feature types (e.g.
   statistics' `WorkStatsData`), inverting the `common → feature` dependency.
   Mirror the same pattern locally instead — e.g. `WORK_STATS_BUILDERS:
   Record<WorkType, (base, review) => WorkStatsData | null>` in
   `useStatisticsData.ts` replaces an inline `if (review.type === ...)`.

Typing the registry as `Record<Enum, ...>` gives exhaustiveness: a new club/work
type won't compile until every registry has an entry for it.

**Gotcha:** icons pulled from a registry reach templates through a computed, so
they're invisible to `icons.test.ts`'s static scan. When you add an icon field to
`CLUB_TYPE_CONFIG`, extend that test's registry check to cover it (see
`frontend-architecture.md` → Icons).
