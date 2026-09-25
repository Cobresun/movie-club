/**
 * Tests for netlify/functions/utils/recommendations.ts
 *
 * The integration suite covers the endpoint end to end; these pin down the
 * scoring rules that are awkward to reach through it — per-member
 * normalisation, agreement, and which seeds may be named.
 */
import { describe, expect, it } from "vitest";

import { SimilarWork } from "../../../../lib/types/recommendations";
import { MemberScore, rankRecommendations, Seed, selectSeeds } from "../recommendations";

function score(
  userId: string,
  externalId: string,
  value: number,
  overrides: Partial<MemberScore> = {},
): MemberScore {
  return {
    userId,
    externalId,
    title: `Title ${externalId}`,
    score: value,
    inClub: true,
    ...overrides,
  };
}

function seed(externalId: string, affinity: number, citable = true): Seed {
  return { externalId, title: `Title ${externalId}`, affinity, citable };
}

function works(...ids: string[]): SimilarWork[] {
  return ids.map((id) => ({ externalId: id, title: `Title ${id}` }));
}

const affinityOf = (seeds: Seed[], externalId: string) =>
  seeds.find((candidate) => candidate.externalId === externalId)?.affinity;

describe("selectSeeds", () => {
  it("reads a harsh scorer's best as a like, where the same score from a generous one is not", () => {
    const seeds = selectSeeds(
      [
        score("harsh", "h1", 2),
        score("harsh", "h2", 2),
        score("harsh", "h3", 3),
        score("harsh", "harsh-best", 6),
        score("generous", "g1", 9),
        score("generous", "g2", 9),
        score("generous", "g3", 9),
        score("generous", "generous-worst", 6),
      ],
      "harsh",
    );

    expect(affinityOf(seeds, "harsh-best")).toBeGreaterThan(0);
    expect(affinityOf(seeds, "generous-worst")).toBeUndefined();
  });

  it("trusts a work more the more members agree on it", () => {
    const seeds = selectSeeds(
      [
        score("m1", "shared", 9),
        score("m1", "filler", 3),
        score("m1", "solo", 9),
        score("m2", "shared", 9),
        score("m2", "filler", 3),
        score("m3", "shared", 9),
        score("m3", "filler", 3),
      ],
      "m1",
    );

    expect(affinityOf(seeds, "shared")).toBeGreaterThan(affinityOf(seeds, "solo") ?? Infinity);
  });

  it("counts a score from another club for less than one given in this club", () => {
    const seeds = selectSeeds(
      [
        score("m1", "here", 9),
        score("m1", "elsewhere", 9, { inClub: false }),
        score("m1", "filler", 3),
      ],
      "m1",
    );

    expect(affinityOf(seeds, "here")).toBeGreaterThan(affinityOf(seeds, "elsewhere") ?? Infinity);
  });

  it("names only works the club reviewed or the viewer scored themselves", () => {
    const seeds = selectSeeds(
      [
        score("viewer", "viewer-elsewhere", 9, { inClub: false }),
        score("viewer", "viewer-filler", 3, { inClub: false }),
        score("other", "other-elsewhere", 9, { inClub: false }),
        score("other", "other-filler", 3, { inClub: false }),
        score("other", "club-pick", 9),
      ],
      "viewer",
    );

    const citable = (externalId: string) =>
      seeds.find((candidate) => candidate.externalId === externalId)?.citable;
    expect(citable("viewer-elsewhere")).toBe(true);
    expect(citable("club-pick")).toBe(true);
    expect(citable("other-elsewhere")).toBe(false);
  });

  it("keeps a member's score from this club when they scored the same work in another", () => {
    const seeds = selectSeeds(
      [
        score("m1", "rewatched", 9),
        score("m1", "rewatched", 1, { inClub: false }),
        score("m1", "filler", 3),
      ],
      "m1",
    );

    expect(affinityOf(seeds, "rewatched")).toBeGreaterThan(0);
  });

  it("returns no seeds when nobody has scored anything", () => {
    expect(selectSeeds([], "m1")).toEqual([]);
  });
});

describe("rankRecommendations", () => {
  const titles = (recommendations: { title: string }[]) => recommendations.map((r) => r.title);

  it("ranks what several liked works point at above what only one does", () => {
    const ranked = rankRecommendations(
      [
        { seed: seed("a", 1), works: works("single", "shared") },
        { seed: seed("b", 1), works: works("shared") },
      ],
      new Set(),
    );

    expect(titles(ranked)).toEqual(["Title shared", "Title single"]);
  });

  it("ranks a work nearer the top of a seed's list above one further down", () => {
    const ranked = rankRecommendations(
      [{ seed: seed("a", 1), works: works("first", "second", "third") }],
      new Set(),
    );

    expect(titles(ranked)).toEqual(["Title first", "Title second", "Title third"]);
  });

  it("drops a work that resembles a disliked seed as much as a liked one", () => {
    const ranked = rankRecommendations(
      [
        { seed: seed("liked", 1), works: works("both", "liked-only") },
        { seed: seed("disliked", -1), works: works("both") },
      ],
      new Set(),
    );

    expect(titles(ranked)).toEqual(["Title liked-only"]);
  });

  it("leaves out excluded works", () => {
    const ranked = rankRecommendations(
      [{ seed: seed("a", 1), works: works("owned", "new") }],
      new Set(["owned"]),
    );

    expect(titles(ranked)).toEqual(["Title new"]);
  });

  it("cites the two citable liked seeds that pulled hardest", () => {
    const [recommendation] = rankRecommendations(
      [
        { seed: seed("weak", 0.5), works: works("x") },
        { seed: seed("strongest-uncitable", 2, false), works: works("x") },
        { seed: seed("strong", 1), works: works("x") },
        { seed: seed("medium", 0.8), works: works("x") },
        { seed: seed("disliked", -0.3), works: works("x") },
      ],
      new Set(),
    );

    expect(recommendation.similarTo).toEqual(["Title strong", "Title medium"]);
  });
});
