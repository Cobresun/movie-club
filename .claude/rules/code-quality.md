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

Keep the register plain. A comment is documentation, not a voice — "the escape hatch we reach for when…", or a note explaining why a mock handler exists at all, gets cut in review. Say what the rule is and stop.

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

The same goes for the non-null assertion `!` and for `as never` / `@ts-expect-error`: each one turns a compiler question into a runtime surprise. In tests these cluster around fixtures and MSW handlers — when a mock body genuinely needs shaping into a type, parse it with a Zod schema rather than asserting it into one. On the backend, `parseBody` with a schema replaces the cast outright (see `backend-architecture.md`).

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

**There is no size of thing that is too big for the registry.** The config already carries copy, icons, labels, search providers, filter options, stats config and similarity scorers; which statistics widgets a club renders belongs there too, as does anything else that would otherwise become a per-club-type branch in a view. If the answer looks like "this logic is too involved for a config entry," put it in a sibling file and register the function — that is still the registry.

The failure mode this prevents is a file that grows an arm per club type: a `filterWorks` that keeps gaining branches, a `WorkDetailsContent` full of movie-vs-book conditionals, an `InsightsView` that decides widgets inline. Writing `clubType === "movie"` in a file that already reads `clubTypeConfig(type)` two lines below is the specific thing reviewers call out; the conditional is exactly what the config exists to prevent.

Judgment still applies: not every `Record<Enum, …>` in the codebase needs to be justified as a club-type registry. This rule is about values that vary _by club or work type_, not about lookup tables in general.

## Identity, and the absence of a value

**Compare entities by id, never by display name.** Two clubs can share a name; so can two works. A check like `candidate.clubName === currentClubName` reads fine and is wrong for the users it matters to. Carry the id on the shape and compare that — add the field rather than inferring identity from what happens to be rendered.

**Prefer `undefined` to `null`** for an absent value in application code. `null` belongs where the database or an external API hands it to you; convert at that boundary rather than propagating both.

**Reach for `lib/checks/checks.ts` before writing a check by hand** — `hasValue` in particular covers the null/undefined/empty case that most hand-rolled conditions are approximating.

## Scope

A pull request should contain the change it says it contains, and reviewers push back hard when it doesn't.

- **Don't add surface area nobody asked for.** A new endpoint that duplicates an existing one with a different name, a parameter no caller passes, a behavior change bundled into a refactor — each gets a "why is this here?" and has to come out. If an existing endpoint can do the job with a different id, use it.
- **Delete dead code rather than half-supporting it.** When a feature is being retired, take out the whole thing — the column, the repository method, the type, the branch. Half-removal gets flagged twice: once for the leftovers, once for the follow-up. If you find an unused legacy column or parameter while working nearby, say so and propose removing it.
- **No drive-by diffs.** `package-lock.json` changes in a PR that added no dependency, reformatting of files the change doesn't touch, and stray local files (screenshots, recordings, editor or tooling config) all get asked about and removed. Check `git status` before committing.
- **Follow-ups are a legitimate answer** to an architectural concern raised mid-review — but only when the concern is genuinely larger than the PR, and it is stated rather than silently deferred.

## Keep these rules true

`.claude/rules/` and `CLAUDE.md` are reviewed like code, and are pulled up in review for saying things that stopped being true — a legacy enum described as though it still exists, a claim about a module that has since been rewritten. When a change makes a sentence in these files wrong, fix the sentence in the same PR. Documenting a rule is also how it stops being repeated in review: if you get the same correction twice, it belongs here.
