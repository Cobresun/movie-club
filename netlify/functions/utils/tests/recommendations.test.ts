/**
 * Tests for netlify/functions/utils/recommendations.ts
 *
 * The integration suite covers the endpoint end to end; these pin down the
 * scoring rules that are awkward to reach through it — per-member
 * normalisation, agreement, which seeds are drawn, and which are named.
 */
import { describe, expect, it } from "vitest";

import { WorkType } from "../../../../lib/types/generated/db";
import { SimilarWork } from "../../../../lib/types/recommendations";
import { MemberScore, rankRecommendations, Seed, selectSeeds } from "../recommendations";

function score(userId: string, externalId: string, value: number): MemberScore {
  return { userId, type: WorkType.movie, externalId, title: `Title ${externalId}`, score: value };
}

function seed(externalId: string, affinity: number): Seed {
  return { externalId, type: WorkType.movie, title: `Title ${externalId}`, affinity };
}

function works(...ids: string[]): SimilarWork[] {
  return ids.map((id) => ({ externalId: id, title: `Title ${id}` }));
}

const affinityOf = (seeds: Seed[], externalId: string) =>
  seeds.find((candidate) => candidate.externalId === externalId)?.affinity;

describe("selectSeeds", () => {
  it("reads a harsh scorer's best as a like, where the same score from a generous one is not", () => {
    const seeds = selectSeeds([
      score("harsh", "h1", 2),
      score("harsh", "h2", 2),
      score("harsh", "h3", 3),
      score("harsh", "harsh-best", 6),
      score("generous", "g1", 9),
      score("generous", "g2", 9),
      score("generous", "g3", 9),
      score("generous", "generous-worst", 6),
    ]);

    expect(affinityOf(seeds, "harsh-best")).toBeGreaterThan(0);
    expect(affinityOf(seeds, "generous-worst")).toBeUndefined();
  });

  it("trusts a work more the more members agree on it", () => {
    const seeds = selectSeeds([
      score("m1", "shared", 9),
      score("m1", "filler", 3),
      score("m1", "solo", 9),
      score("m2", "shared", 9),
      score("m2", "filler", 3),
      score("m3", "shared", 9),
      score("m3", "filler", 3),
    ]);

    expect(affinityOf(seeds, "shared")).toBeGreaterThan(affinityOf(seeds, "solo") ?? Infinity);
  });

  describe("with more likes than it starts from", () => {
    // One harsh scorer and twelve films they rated above their habit, all equally.
    const manyLikes = [
      ...["d1", "d2", "d3", "d4", "d5", "d6"].map((id) => score("m1", id, 1)),
      ...Array.from({ length: 12 }, (_, index) => score("m1", `liked-${index}`, 9)),
    ];
    const likedIds = (seeds: Seed[]) =>
      seeds
        .filter((candidate) => candidate.affinity > 0)
        .map((candidate) => candidate.externalId)
        .sort();

    it("starts from eight of them", () => {
      expect(likedIds(selectSeeds(manyLikes))).toHaveLength(8);
    });

    it("starts from a different eight from one visit to the next", () => {
      const ascending = (() => {
        let call = 0;
        return () => ++call / 100;
      })();
      const descending = (() => {
        let call = 0;
        return () => 1 - ++call / 100;
      })();

      expect(likedIds(selectSeeds(manyLikes, ascending))).not.toEqual(
        likedIds(selectSeeds(manyLikes, descending)),
      );
    });
  });

  it("starts from every like when there are no more than eight", () => {
    const seeds = selectSeeds([
      score("m1", "d1", 1),
      score("m1", "d2", 1),
      score("m1", "a", 9),
      score("m1", "b", 9),
    ]);

    expect(affinityOf(seeds, "a")).toBeGreaterThan(0);
    expect(affinityOf(seeds, "b")).toBeGreaterThan(0);
  });

  it("returns no seeds when nobody has scored anything", () => {
    expect(selectSeeds([])).toEqual([]);
  });
});

describe("rankRecommendations", () => {
  const titles = (recommendations: { title: string }[]) => recommendations.map((r) => r.title);

  it("ranks what several liked works point at above what only one does", () => {
    const ranked = rankRecommendations([
      { seed: seed("a", 1), works: works("single", "shared") },
      { seed: seed("b", 1), works: works("shared") },
    ]);

    expect(titles(ranked)).toEqual(["Title shared", "Title single"]);
  });

  it("ranks a work nearer the top of a seed's list above one further down", () => {
    const ranked = rankRecommendations([
      { seed: seed("a", 1), works: works("first", "second", "third") },
    ]);

    expect(titles(ranked)).toEqual(["Title first", "Title second", "Title third"]);
  });

  it("drops a work that resembles a disliked seed as much as a liked one", () => {
    const ranked = rankRecommendations([
      { seed: seed("liked", 1), works: works("both", "liked-only") },
      { seed: seed("disliked", -1), works: works("both") },
    ]);

    expect(titles(ranked)).toEqual(["Title liked-only"]);
  });

  it("cites the two liked seeds that pulled hardest", () => {
    const [recommendation] = rankRecommendations([
      { seed: seed("weak", 0.5), works: works("x") },
      { seed: seed("strong", 1), works: works("x") },
      { seed: seed("medium", 0.8), works: works("x") },
      { seed: seed("disliked", -0.3), works: works("x") },
    ]);

    expect(recommendation.similarTo).toEqual(["Title strong", "Title medium"]);
  });
});
