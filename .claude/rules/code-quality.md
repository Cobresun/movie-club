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

- Default to none. Write one only for a _why_ the code can't show: a non-obvious rule, an ordering constraint, a deliberate deviation someone would otherwise "fix".
- Never refer to a previous implementation or to the review (`// now uses the registry`, `// changed per feedback`), and delete commented-out code. Git holds the history.
- Plain register: state the rule and stop.
- After a mid-PR design change, re-read every comment on what you touched against the final code.
- In shared code, describe works and child works, not one club type.

## Types and checks

- Presence checks use `lib/checks/checks.ts` (`isDefined`, `hasValue`, `hasElements`, `isString`, `isRecord`, `ensure`), not `!== undefined`, `!= null` or `.trim() !== ""`. Lint does not catch the hand-written form; review does.
- No `as`, `!`, `as never` or `@ts-expect-error`. Each hides a question the compiler was asking. Narrow instead:

  | Instead of                         | Write                                                    |
  | ---------------------------------- | -------------------------------------------------------- |
  | `event.target as HTMLInputElement` | `event.target instanceof HTMLInputElement`               |
  | `(error as Error).message`         | `error instanceof Error ? error.message : String(error)` |
  | `route.params.slug as string`      | `isString(route.params.slug)`                            |
  | `JSON.parse(stored) as Filters`    | a Zod schema (localStorage, query strings, responses)    |
  | `event.body as Dto`                | `parseBody` (`backend-architecture.md`)                  |
  | a cast in a spec                   | `testing.md` → No casts                                  |

- An absent value is `undefined`, not `null`. Convert `null` where the database or an external API hands it over. In our own request and response shapes an absent field is optional, not a `null` sentinel.
- Compare entities by id, never by display name. Two clubs or two works can share a name.

## Reactivity

- Pass query data down as props and key the child on its identity (`<ClubDetails v-if="club" :key="club.id" :club="club" />`) rather than `watch()`-ing a query result. Vue rebuilds the child with clean state.
- A watcher that derives state is a `computed`; one that mirrors a prop is `v-model`; one that redirects is a route guard. Keep `watch` for real side effects: localStorage, browser APIs, animation.

## Club-type variation goes in a registry

Anything that varies by club or work type (copy, icons, tabs, widgets, behavior, data construction) is a registry entry, never an inline `clubType === …` branch. Adding a club type should mean adding entries, not hunting conditionals.

- **Cross-feature values** go in `CLUB_TYPE_CONFIG` (`src/common/clubType/`): add the field to `ClubTypeConfig` in `types.ts`, fill it in each type's folder (`movie/`, `book/`, `tv/`), read it with `clubTypeConfig(type)`.
- **Values that depend on a feature's own types** go in a feature-local `Record<Enum, …>` (`WORK_STATS_BUILDERS`, `REVIEW_LAYOUTS`), so `src/common` never imports from a feature.
- **Logic too involved for a config entry** goes in a sibling file, and the function is registered.
- Type registries as `Record<Enum, …>` so a new type fails to compile until every registry covers it.
- An icon field added to `CLUB_TYPE_CONFIG` also needs `icons.test.ts`'s registry check extended; its static scan can't see computed names.

These are branches too, and have each been sent back:

- A default club type while the club loads (`club.value?.type ?? ClubType.MOVIE`). Wait for the club, then look the type up. Existing fallbacks are not a model.
- A type guard or type-specific field read in a component (`isMovieStats(…)`, `externalData.runtime`). It belongs with that type's registry entry.
- One club type importing from another (`tv/` from `movie/`, a TV provider using a movie-named type). Shared code goes in a neutral module with a neutral name.
- A type-specific component among shared ones. Put it in a folder named for its type, like `reviews/components/tv/`.

The backend half of this rule is in `backend-architecture.md`.

## Scope

A PR contains the change it says it contains.

- **No unrequested surface area**: an endpoint that duplicates an existing one, a parameter no caller passes, a behavior change inside a refactor.
- **Search before adding a helper.** Grep for the existing URL builder, mapper or aggregate and extend it. TMDB images: `src/common/tmdbImages.ts`, `src/common/workDisplay.ts`, `netlify/functions/utils/tmdb.ts`.
- **Delete dead code completely**: the column, the repository method, the type and the branch together. Before pushing, check that every field, map entry and branch the PR adds is still read after any redesign.
- **No drive-by diffs**: a lockfile (`package-lock.json`, `deno.lock`) whose manifest didn't change, reformatting of untouched files, stray local files.
- A follow-up is a fair answer to a concern larger than the PR, if it is stated rather than silently deferred.
