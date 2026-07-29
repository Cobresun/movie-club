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

test("purely additive migrations reuse the database with no rollback", () => {
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1), "002_new.ts": h(2) },
      cachedManifest: { "001_base.ts": h(1) },
      applied: ["001_base"],
      prLocal: ["002_new.ts"],
    }),
    { reuse: true, rollback: 0 },
  );
});

test("editing an already-applied migration this PR owns rolls it back", () => {
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1), "002_mine.ts": h("2b") },
      cachedManifest: { "001_base.ts": h(1), "002_mine.ts": h("2a") },
      applied: ["001_base", "002_mine"],
      prLocal: ["002_mine.ts"],
    }),
    { reuse: true, rollback: 1 },
  );
});

test("a trailing run of edited migrations rolls back all of them", () => {
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1), "002_mine.ts": h("2b"), "003_mine.ts": h("3b") },
      cachedManifest: { "001_base.ts": h(1), "002_mine.ts": h("2a"), "003_mine.ts": h("3a") },
      applied: ["001_base", "002_mine", "003_mine"],
      prLocal: ["002_mine.ts", "003_mine.ts"],
    }),
    { reuse: true, rollback: 2 },
  );
});

test("a database that exists but has no migrations applied needs no rollback", () => {
  assert.deepEqual(
    planDatabaseReuse({
      manifest: { "001_base.ts": h(1) },
      cachedManifest: {},
      applied: [],
      prLocal: ["001_base.ts"],
    }),
    { reuse: true, rollback: 0 },
  );
});

test("editing a migration that is already on main forces a rebuild", () => {
  // We must not exercise a merged migration's down(); a restore is the only
  // way back to a known-good schema.
  const plan = planDatabaseReuse({
    manifest: { "001_base.ts": h("1b") },
    cachedManifest: { "001_base.ts": h("1a") },
    applied: ["001_base"],
    prLocal: [],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /already on main/);
});

test("a merged migration applied after ours forces a rebuild", () => {
  // Rolling back to 001_mine would also unwind 002_from_main, which we own no
  // right to reverse.
  const plan = planDatabaseReuse({
    manifest: { "001_mine.ts": h("1b"), "002_from_main.ts": h(2) },
    cachedManifest: { "001_mine.ts": h("1a"), "002_from_main.ts": h(2) },
    applied: ["001_mine", "002_from_main"],
    prLocal: ["001_mine.ts"],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /would also unwind/);
});

test("an applied migration whose file disappeared forces a rebuild", () => {
  const plan = planDatabaseReuse({
    manifest: { "001_base.ts": h(1) },
    cachedManifest: { "001_base.ts": h(1), "002_gone.ts": h(2) },
    applied: ["001_base", "002_gone"],
    prLocal: [],
  });

  assert.equal(plan.reuse, false);
  assert.match(plan.reason, /no longer exists/);
});

test("missing inputs are never guessed at", () => {
  // No cached manifest: first build for this PR, or the cache predates the
  // manifest format. Either way we cannot know what the database contains.
  assert.equal(
    planDatabaseReuse({ manifest: {}, cachedManifest: null, applied: [], prLocal: [] }).reuse,
    false,
  );

  // git comparison against origin/main failed, so "which migrations does this
  // PR own" is unanswerable.
  assert.equal(
    planDatabaseReuse({ manifest: {}, cachedManifest: {}, applied: [], prLocal: null }).reuse,
    false,
  );
});
