/**
 * Integration tests for `netlify/functions/admin.ts`.
 *
 * Every dashboard query runs against the real schema, seeded through the same
 * endpoints a club uses. Signups are left unasserted: the auth tables survive
 * between tests (see `helpers/database.ts`), so user counts depend on which
 * files ran first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminDashboard, SnapshotHistoryPoint } from "../../../lib/types/metrics";
import { handler } from "../admin";
import captureSnapshot from "../scheduled-metrics-snapshot";
import { FIXTURE_USERS, signIn, TestSession } from "./helpers/auth";
import {
  addComment,
  addReviewedWork,
  addWork,
  createClub,
  scoreWork,
  SeededClub,
} from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

const DAY_MS = 24 * 60 * 60 * 1000;

let admin: TestSession;

const dashboard = async (range?: string) => {
  const res = await api.get<AdminDashboard>("/api/admin/metrics", {
    as: admin,
    ...(range === undefined ? {} : { query: { range } }),
  });
  expect(res.statusCode).toBe(200);
  return res.body;
};

/** Every listed member scores the same work, in order. */
async function reviewTogether(
  club: SeededClub,
  reviewers: [TestSession, number][],
  options: Parameters<typeof addReviewedWork>[2] = {},
) {
  const work = await addReviewedWork(club, reviewers[0][0], options);
  for (const [reviewer, score] of reviewers) {
    await scoreWork(club, reviewer, work.id, score);
  }
  return work;
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_USER_EMAILS", FIXTURE_USERS.alice.email);
  admin = await signIn("alice");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access", () => {
  it("turns away a signed-in user who is not on the allowlist", async () => {
    const bob = await signIn("bob");

    const res = await api.get("/api/admin/metrics", { as: bob });

    expect(res.statusCode).toBe(401);
  });

  it("turns everyone away when the allowlist is empty", async () => {
    vi.stubEnv("ADMIN_USER_EMAILS", "");

    const res = await api.get("/api/admin/metrics/history", { as: admin });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/admin/metrics", () => {
  it("counts what happened in the range against the range before it", async () => {
    const bob = await signIn("bob");
    const club = await createClub(admin, { members: [admin, bob] });
    const work = await reviewTogether(club, [
      [admin, 8],
      [bob, 6],
    ]);
    await addComment(club, bob, work.id, "Loved the ending");

    const { pulse } = await dashboard("30d");

    expect(pulse.activeClubs).toEqual({ current: 1, previous: 0 });
    expect(pulse.activeUsers).toEqual({ current: 2, previous: 0 });
    expect(pulse.reviews).toEqual({ current: 2, previous: 0 });
    expect(pulse.comments).toEqual({ current: 1, previous: 0 });
    expect(pulse.newClubs).toEqual({ current: 1, previous: 0 });
  });

  it("counts a club in every window it was active in", async () => {
    // A club active in two windows belongs in both. Counting several windows
    // with `count(DISTINCT …) FILTER` in one SELECT gets this wrong on
    // CockroachDB (see .claude/rules/database.md); this fixture is too small to
    // trigger that locally, but it pins down the answer the fix must give.
    const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
    const steady = await createClub(admin);
    const lapsed = await createClub(admin);
    // Newest first as well as oldest first, so the result cannot depend on
    // which of a club's rows happens to be read first.
    await addWork(steady, admin, { addedDate: daysAgo(1) });
    for (const club of [steady, lapsed]) {
      await addWork(club, admin, { addedDate: daysAgo(10) });
      await addWork(club, admin, { addedDate: daysAgo(200) });
    }
    await addWork(steady, admin, { addedDate: daysAgo(2) });

    const week = await dashboard("7d");
    const month = await dashboard("30d");

    expect(week.pulse.activeClubs).toEqual({ current: 1, previous: 2 });
    expect(week.pulse.activeUsers).toEqual({ current: 1, previous: 1 });
    expect(month.pulse.activeClubs).toEqual({ current: 2, previous: 0 });
  });

  it("has nothing to compare against over all time", async () => {
    const club = await createClub(admin);
    await reviewTogether(club, [[admin, 7]]);

    const { pulse } = await dashboard("all");

    expect(pulse.reviews).toEqual({ current: 1, previous: null });
    expect(pulse.activeClubs.previous).toBeNull();
  });

  it("falls back to 30 days for a range it does not recognise", async () => {
    expect((await dashboard("fortnight")).range).toBe("30d");
    expect((await dashboard()).range).toBe("30d");
  });

  it("slices activity into zero-filled days ending today", async () => {
    const club = await createClub(admin);
    await reviewTogether(club, [[admin, 7]]);

    const { activity } = await dashboard("7d");

    expect(activity.unit).toBe("day");
    // Seven days back from mid-day touches eight calendar dates.
    expect(activity.buckets).toHaveLength(8);
    expect(activity.buckets.at(-1)).toMatchObject({
      bucket: new Date().toISOString().slice(0, 10),
      reviews: 1,
      listAdds: 1,
    });
    expect(activity.buckets.slice(0, -1).every((bucket) => bucket.reviews === 0)).toBe(true);
  });

  it("groups a title across the clubs that reviewed it", async () => {
    const [bob, carol] = await Promise.all([signIn("bob"), signIn("carol")]);
    const first = await createClub(admin, { members: [admin, bob, carol] });
    const second = await createClub(bob);

    await reviewTogether(
      first,
      [
        [admin, 9],
        [bob, 5],
        [carol, 7],
      ],
      { title: "The Matrix", externalId: "603" },
    );
    await reviewTogether(second, [[bob, 7]], { title: "The Matrix", externalId: "603" });
    await reviewTogether(
      first,
      [
        [admin, 10],
        [bob, 10],
      ],
      { title: "Two Reviews Only", externalId: "999" },
    );

    const { works } = await dashboard("30d");

    expect(works.mostReviewed.map((work) => work.title)).toEqual([
      "The Matrix",
      "Two Reviews Only",
    ]);
    expect(works.mostReviewed[0]).toMatchObject({ reviews: 4, clubs: 2, averageScore: 7 });
    expect(works.mostReviewed[0].spread).toBeCloseTo(Math.sqrt(2));

    // Two reviews are not enough to call anything the best or most divisive.
    expect(works.highestRated.map((work) => work.title)).toEqual(["The Matrix"]);
    expect(works.mostDivisive.map((work) => work.title)).toEqual(["The Matrix"]);
  });

  it("keeps a watch-list add inside the range it was made in", async () => {
    const bob = await signIn("bob");
    const first = await createClub(admin);
    const second = await createClub(bob);
    const fiftyDaysAgo = new Date(Date.now() - 50 * DAY_MS);

    await addWork(first, admin, { title: "Dune", externalId: "438631", addedDate: fiftyDaysAgo });
    await addWork(second, bob, { title: "Dune", externalId: "438631", addedDate: fiftyDaysAgo });

    const recent = await dashboard("30d");
    const quarter = await dashboard("90d");

    expect(recent.works.mostWanted).toEqual([]);
    expect(quarter.works.mostWanted).toEqual([
      expect.objectContaining({ title: "Dune", clubs: 2, adds: 2 }),
    ]);
    expect(quarter.pulse.activeClubs.current).toBe(2);
    expect(recent.pulse.activeClubs).toEqual({ current: 0, previous: 2 });
  });

  it("sorts every club by how recently it did anything", async () => {
    const active = await createClub(admin);
    await reviewTogether(active, [[admin, 6]]);

    const quiet = await createClub(admin);
    await addWork(quiet, admin, { addedDate: new Date(Date.now() - 45 * DAY_MS) });

    const dormant = await createClub(admin);
    await addWork(dormant, admin, { addedDate: new Date(Date.now() - 200 * DAY_MS) });

    await createClub(admin);
    await createClub(admin, { members: [] });

    const { health } = await dashboard("30d");

    expect(health.clubStatus).toEqual({
      active: 1,
      quiet: 1,
      dormant: 1,
      neverStarted: 2,
      empty: 1,
    });
  });

  it("measures how much of what was reviewed got talked about", async () => {
    const club = await createClub(admin);
    const discussed = await reviewTogether(club, [[admin, 8]]);
    await reviewTogether(club, [[admin, 4]]);
    await addComment(club, admin, discussed.id, "Worth a rewatch");

    const { health } = await dashboard("30d");

    expect(health.discussion).toEqual({ numerator: 1, denominator: 2 });
    // Alice's session is from this test run, and she wrote something.
    expect(health.contribution.numerator).toBeGreaterThanOrEqual(1);
  });

  it("ranks clubs and people by what they did, naming who is involved", async () => {
    const bob = await signIn("bob");
    const busy = await createClub(admin, { name: "Busy Club", members: [admin, bob] });
    const light = await createClub(bob, { name: "Light Club" });

    await reviewTogether(busy, [
      [admin, 8],
      [bob, 7],
    ]);
    await reviewTogether(busy, [[admin, 5]]);
    await reviewTogether(light, [[bob, 6]]);

    const { clubs, people } = await dashboard("7d");

    expect(clubs.busiest.map((club) => club.name)).toEqual(["Busy Club", "Light Club"]);
    expect(clubs.busiest[0]).toMatchObject({ reviews: 3, memberNames: ["Alice", "Bob"] });
    expect(clubs.busiest[0].lastActiveAt).not.toBeNull();
    expect(clubs.newest.map((club) => club.name).sort()).toEqual(["Busy Club", "Light Club"]);

    expect(people.mostActive.map((person) => person.name)).toEqual(["Alice", "Bob"]);
    expect(people.mostActive[0]).toMatchObject({ reviews: 2, listAdds: 2, comments: 0, clubs: 1 });
    expect(people.mostActive[1]).toMatchObject({ reviews: 2, listAdds: 1, clubs: 2 });
  });

  it("shows the latest reviews and comments, newest first", async () => {
    const club = await createClub(admin, { name: "Feed Club" });
    const work = await reviewTogether(club, [[admin, 8.5]], { title: "Arrival" });
    await addComment(club, admin, work.id, "That score");

    const { feed } = await dashboard("7d");

    expect(feed).toEqual([
      expect.objectContaining({ kind: "comment", workTitle: "Arrival", score: null }),
      expect.objectContaining({
        kind: "review",
        userName: "Alice",
        clubName: "Feed Club",
        clubSlug: club.slug,
        workTitle: "Arrival",
        score: 8.5,
      }),
    ]);
  });
});

describe("GET /api/admin/metrics/history", () => {
  it("reads back what the daily snapshot job recorded", async () => {
    const club = await createClub(admin);
    await reviewTogether(club, [[admin, 7]]);

    const captured = await captureSnapshot(
      new Request("http://localhost/.netlify/functions/scheduled-metrics-snapshot", {
        method: "POST",
        body: JSON.stringify({ next_run: new Date().toISOString() }),
      }),
    );
    expect(captured.status).toBe(200);

    const res = await api.get<SnapshotHistoryPoint[]>("/api/admin/metrics/history", {
      as: admin,
      query: { range: "7d" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].capturedOn).toBe(new Date().toISOString().slice(0, 10));
    expect(res.body[0].metrics.totals).toMatchObject({ clubs: 1, reviews: 1 });
    expect(res.body[0].metrics.activeClubs).toEqual({ last7Days: 1, last30Days: 1 });
    expect(res.body[0].metrics.health?.dormantClubs).toEqual({ numerator: 0, denominator: 1 });
  });
});
