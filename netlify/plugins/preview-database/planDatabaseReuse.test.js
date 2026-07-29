/**
 * Run with `node netlify/plugins/preview-database/planDatabaseReuse.test.js`.
 *
 * Not a vitest suite: vitest is rooted at `src/` (see vite.config.ts), and
 * widening that root to reach the build plugins is a bigger change than this
 * logic warrants. `node:test` is built in and CI runs it as its own step.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { planDatabaseReuse } from "./planDatabaseReuse.js";

const h = (seed) => `hash-${seed}`;

test("a new migration on top of untouched ones reuses the database", () => {
  // The saving this optimisation exists for: a PR pushes another commit and
  // adds a migration. The build applies 002 to the database it already has.
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1), "002_new.ts": h(2) },
      cachedManifest: { "001_base.ts": h(1) },
      applied: ["001_base"],
    }),
    { reuse: true },
  );
});

test("a rebuild with no migration changes at all reuses the database", () => {
  // The other saving: a commit that touches no migration file still triggers a
  // build, and today that build pays a full restore for nothing.
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1), "002_mine.ts": h(2) },
      cachedManifest: { "001_base.ts": h(1), "002_mine.ts": h(2) },
      applied: ["001_base", "002_mine"],
    }),
    { reuse: true },
  );
});

test("a database that exists but has no migrations applied is reusable", () => {
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1) },
      cachedManifest: {},
      applied: [],
    }),
    { reuse: true },
  );
});

test("editing a migration this PR already applied forces a rebuild", () => {
  // The tempting move is to reverse it with down() and let the build re-apply.
  // We don't: down() is not a reliable inverse and does not have to throw to be
  // wrong, so a restore is the only way back to a known-good schema.
  const plan = planDatabaseReuse({
    manifest: { "001_base.ts": h(1), "002_mine.ts": h("2b") },
    cachedManifest: { "001_base.ts": h(1), "002_mine.ts": h("2a") },
    applied: ["001_base", "002_mine"],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /changed after it was applied/);
});

test("editing a migration that is already on main forces a rebuild", () => {
  const plan = planDatabaseReuse({
    manifest: { "001_base.ts": h("1b") },
    cachedManifest: { "001_base.ts": h("1a") },
    applied: ["001_base"],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /changed after it was applied/);
});

test("an edited migration sitting before an untouched one still forces a rebuild", () => {
  const plan = planDatabaseReuse({
    manifest: { "001_mine.ts": h("1b"), "002_from_main.ts": h(2) },
    cachedManifest: { "001_mine.ts": h("1a"), "002_from_main.ts": h(2) },
    applied: ["001_mine", "002_from_main"],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /001_mine/);
});

test("an applied migration whose file disappeared forces a rebuild", () => {
  const plan = planDatabaseReuse({
    manifest: { "001_base.ts": h(1) },
    cachedManifest: { "001_base.ts": h(1), "002_gone.ts": h(2) },
    applied: ["001_base", "002_gone"],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /no longer exists/);
});

test("missing inputs are never guessed at", () => {
  // No cached manifest: first build for this PR, or the cache predates the
  // manifest format. Either way we cannot know what the database contains.
  assert.equal(planDatabaseReuse({ manifest: {}, cachedManifest: null, applied: [] }).reuse, false);
});
