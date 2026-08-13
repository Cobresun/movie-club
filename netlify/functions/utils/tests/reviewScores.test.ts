/**
 * Tests for netlify/functions/utils/reviewScores.ts
 *
 * `buildReviewScores` is the single place the reviews payload's `scores` map is
 * assembled (#421 extracted it so the list endpoint and the per-work polling
 * endpoint cannot drift), so its filtering and averaging rules are worth
 * pinning down.
 */
import { describe, expect, it } from "vitest";

import { buildReviewScores, ScoreEntry } from "../reviewScores";

function entry(overrides: Partial<ScoreEntry> = {}): ScoreEntry {
  return {
    user_id: "user-1",
    review_id: "review-1",
    score: "8",
    created_date: new Date("2024-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildReviewScores", () => {
  it("returns an empty map when nobody has scored", () => {
    expect(buildReviewScores([], new Set(["user-1"]))).toEqual({});
  });

  it("keys each score by its member and parses the numeric score", () => {
    const scores = buildReviewScores([entry()], new Set(["user-1"]));

    expect(scores["user-1"]).toEqual({
      id: "review-1",
      created_date: "2024-05-01T00:00:00.000Z",
      score: 8,
    });
  });

  it("parses fractional scores rather than truncating them", () => {
    const scores = buildReviewScores([entry({ score: "7.25" })], new Set(["user-1"]));

    expect(scores["user-1"]?.score).toBe(7.25);
  });

  it("adds a synthetic average across the members who scored", () => {
    const scores = buildReviewScores(
      [
        entry({ user_id: "user-1", review_id: "r1", score: "6" }),
        entry({ user_id: "user-2", review_id: "r2", score: "9" }),
      ],
      new Set(["user-1", "user-2"]),
    );

    expect(scores.average?.score).toBe(7.5);
    expect(scores.average?.id).toBe("average");
  });

  it("drops scores from users who are no longer club members", () => {
    const scores = buildReviewScores(
      [
        entry({ user_id: "member", review_id: "r1", score: "10" }),
        entry({ user_id: "departed", review_id: "r2", score: "2" }),
      ],
      new Set(["member"]),
    );

    expect(scores.departed).toBeUndefined();
    // The departed score must not drag the average down either.
    expect(scores.average?.score).toBe(10);
  });

  it("returns an empty map when every scorer has left the club", () => {
    const scores = buildReviewScores([entry({ user_id: "departed" })], new Set(["member"]));

    expect(scores).toEqual({});
  });

  it("ignores rows left null by the outer join for unscored works", () => {
    const scores = buildReviewScores(
      [entry({ user_id: null, review_id: null, score: null, created_date: null })],
      new Set(["user-1"]),
    );

    expect(scores).toEqual({});
  });

  it("ignores a row whose score is missing even when the reviewer is present", () => {
    const scores = buildReviewScores([entry({ score: null })], new Set(["user-1"]));

    expect(scores).toEqual({});
  });
});
