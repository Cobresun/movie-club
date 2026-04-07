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
