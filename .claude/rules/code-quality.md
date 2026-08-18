---
paths:
  - "src/**"
  - "netlify/**"
  - "lib/**"
  - "migrations/**"
  - "scripts/**"
---

# Code Quality

## Comments

Default to no comment. The code, the types, and the test names carry the _what_; a comment that restates them goes stale and earns nothing. Write one only for tricky business logic that needs a _why_ — a non-obvious rule, an ordering constraint, a deliberate deviation someone would otherwise "fix."

Never write a comment that references a previous implementation. `// now uses the registry instead of the old ternary`, `// replaces the legacy data migration`, `// keeping this for backwards compat with the old shape` — none of that survives contact with a reader who never saw the old code, and git history already holds it. Describe what the code does now, or say nothing. The same goes for comments addressed at review time (`// changed per feedback`) and for commented-out code: delete it.

```ts
// Bad — restates the code, and dates itself against a version nobody can see.
// Look up the config from the registry (used to be a switch on clubType)
const config = clubTypeConfig(type);

// Good — a rule the reader cannot derive from the code.
// Awards ties resolve to the earlier nomination, matching how the club votes in person.
```

## Type guards

`lib/checks/checks.ts` holds this codebase's null/empty checks — `hasValue`, `isDefined`, `isString`, `isTrue`, `hasElements`, `ensure`, `filterUndefinedProperties`. Read the signatures there; they're written to narrow types and to satisfy oxlint's `typescript/strict-boolean-expressions`, which rejects most hand-rolled truthiness checks anyway. Reach for these before writing a manual `x && x.trim() !== ""`.

## `as` casts

Treat an `as` cast as a signal that something upstream is wrong, and fix that instead. `as unknown as T` in particular silences the compiler without buying safety.

The common case is a test casting to build an input the types forbid (`undefined as unknown as number`). That test is usually asserting on a state the type system already prevents — deleting it is the right fix, not casting to keep it alive.

## Prefer keyed components to `watch()`

For query data, pass values down as props and key the child on the identity that changed:

```vue
<ClubDetails v-if="club" :key="club.id" :club="club" />
```

Vue tears down and rebuilds with clean state, which makes data flow explicit and sidesteps stale closures and watcher ordering. `watch()` on a query result is usually a sign this pattern was skipped.

Watchers are the right tool for genuinely reactive side effects — syncing to localStorage or a browser API, driving an animation.

## Club-type variation: registry, not conditionals

Anything varying by club type — copy, icons, labels, behavior, per-type data construction — belongs in a registry rather than an inline `clubType === ...` / `review.type === ...` branch. Adding a club type should mean adding one registry entry, not hunting conditionals across widgets and views.

```ts
// Instead of a per-component ternary on props.clubType:
const stats = computed(() => clubTypeStats(props.clubType));
```

Which registry depends on what the value depends on:

1. **Cross-feature display/behavior** → the shared `CLUB_TYPE_CONFIG` in `src/common/clubType.ts`. Add a field or sub-block, read it via a helper like `clubTypeConfig(type)`. Components take `clubType` as a prop and look it up.
2. **Logic depending on a feature's own types** → a feature-local `Record<Enum, ...>`, _not_ `src/common`. Putting it in `clubType.ts` would force the shared module to import feature types (e.g. statistics' `WorkStatsData`), inverting the `common → feature` dependency. Mirror the pattern locally instead — `WORK_STATS_BUILDERS` in `useStatisticsData.ts` is the example.

Typing registries as `Record<Enum, ...>` buys exhaustiveness: a new club/work type won't compile until every registry covers it.

**Gotcha:** registry icons reach templates through a computed, so `icons.test.ts`'s static scan can't see them. Adding an icon field to `CLUB_TYPE_CONFIG` means extending that test's registry check too — see `frontend-architecture.md` → Icons.
