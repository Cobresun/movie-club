import { DetailedBookData } from "../../../../lib/types/book";
import { WorkType } from "../../../../lib/types/generated/db";
import {
  DetailedReviewListItem,
  DetailedWorkData,
  Review,
} from "../../../../lib/types/lists";
import { DetailedMovieData } from "../../../../lib/types/movie";
import {
  answerComparison,
  buildCandidatePool,
  isScoreAssistEligible,
  MAX_COMPARISONS,
  ScoredCandidate,
  startSession,
} from "../composables/scoreAssistLogic";
import { workSimilarity } from "../composables/scoreAssistSimilarity";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

function movieData(
  opts: { directors?: string[]; genres?: string[] } = {},
): DetailedMovieData {
  return {
    kind: "movie",
    actors: [],
    directors: (opts.directors ?? []).map((name) => ({
      name,
      profilePath: null,
    })),
    genres: opts.genres ?? [],
    production_companies: [],
    production_countries: [],
  };
}

function bookData(
  opts: { authors?: string[]; subjects?: string[] } = {},
): DetailedBookData {
  return {
    kind: "book",
    title: "A Book",
    authors: opts.authors ?? [],
    subjects: opts.subjects ?? [],
  };
}

function candidate(
  workId: string,
  score: number,
  opts: { title?: string; externalData?: DetailedWorkData } = {},
): ScoredCandidate {
  return {
    workId,
    title: opts.title ?? `Work ${workId}`,
    score,
    externalData: opts.externalData,
  };
}

/**
 * Every item carries an "average" pseudo-score and another member's score, so
 * any test that counts candidates implicitly proves both are ignored.
 */
function reviewItem(
  id: string,
  opts: {
    userScore?: number;
    title?: string;
    externalData?: DetailedWorkData;
  } = {},
): DetailedReviewListItem {
  const scores: Record<string, Review> = {
    average: { id: `avg-${id}`, created_date: "2024-01-01", score: 6 },
    [OTHER_USER_ID]: {
      id: `other-${id}`,
      created_date: "2024-01-01",
      score: 6,
    },
  };
  if (opts.userScore !== undefined) {
    scores[USER_ID] = {
      id: `review-${id}`,
      created_date: "2024-01-01",
      score: opts.userScore,
    };
  }
  return {
    id,
    type: WorkType.movie,
    title: opts.title ?? `Work ${id}`,
    createdDate: "2024-01-01",
    scores,
    externalData: opts.externalData,
  };
}

function target(externalData?: DetailedWorkData): DetailedReviewListItem {
  return reviewItem("target", { userScore: undefined, externalData });
}

/** Candidates scored 1..9, no metadata — the workhorse pool. */
const ladder = () =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((score) => candidate(`w${score}`, score));

describe("buildCandidatePool", () => {
  it("collects only the current user's scored works, excluding the target", () => {
    const reviews = [
      reviewItem("target", { userScore: 8 }),
      reviewItem("a", { userScore: 7 }),
      // Only the average + another member's score: must not become a candidate.
      reviewItem("b", {}),
      reviewItem("c", { userScore: 3 }),
    ];
    const pool = buildCandidatePool(reviews, USER_ID, "target");
    expect(pool.map((item) => item.workId)).toEqual(["c", "a"]);
  });

  it("sorts ascending by score with a title tie-break", () => {
    const reviews = [
      reviewItem("a", { userScore: 7, title: "Zulu" }),
      reviewItem("b", { userScore: 7, title: "Alpha" }),
      reviewItem("c", { userScore: 2 }),
    ];
    const pool = buildCandidatePool(reviews, USER_ID, "target");
    expect(pool.map((item) => item.workId)).toEqual(["c", "b", "a"]);
  });

  it("drops non-finite scores", () => {
    const reviews = [
      reviewItem("a", { userScore: Number.NaN }),
      reviewItem("b", { userScore: 5 }),
    ];
    const pool = buildCandidatePool(reviews, USER_ID, "target");
    expect(pool.map((item) => item.workId)).toEqual(["b"]);
  });
});

describe("isScoreAssistEligible", () => {
  it("requires five scored works besides the target", () => {
    const four = [1, 2, 3, 4].map((n) => reviewItem(`w${n}`, { userScore: n }));
    const targetItem = reviewItem("target", { userScore: 8 });
    expect(
      isScoreAssistEligible([...four, targetItem], USER_ID, "target"),
    ).toBe(false);
    const five = [...four, reviewItem("w5", { userScore: 5 })];
    expect(
      isScoreAssistEligible([...five, targetItem], USER_ID, "target"),
    ).toBe(true);
  });

  it("is false without reviews or a user", () => {
    expect(isScoreAssistEligible(undefined, USER_ID, "target")).toBe(false);
    expect(isScoreAssistEligible([], undefined, "target")).toBe(false);
  });
});

describe("pivot selection", () => {
  it("starts from the rank-middle of the pool", () => {
    const session = startSession(target(), ladder());
    expect(session.pivot?.score).toBe(5);
  });

  it("prefers a similar work over the score-midpoint within the window", () => {
    const nolan = movieData({ directors: ["Nolan"] });
    const pool = ladder().map((item) =>
      item.workId === "w4" ? candidate("w4", 4, { externalData: nolan }) : item,
    );
    const session = startSession(target(nolan), pool);
    expect(session.pivot?.workId).toBe("w4");
  });

  it("breaks similarity ties towards the bracket's score midpoint", () => {
    const drama = movieData({ genres: ["Drama"] });
    const pool = ladder().map((item) =>
      item.workId === "w4" || item.workId === "w5"
        ? candidate(item.workId, item.score, { externalData: drama })
        : item,
    );
    const session = startSession(target(drama), pool);
    expect(session.pivot?.workId).toBe("w5");
  });
});

describe("answerComparison", () => {
  it("narrows the bracket on more/less and records the bracketing works", () => {
    let session = startSession(target(), ladder());
    expect(session.pivot?.score).toBe(5);

    session = answerComparison(session, "more");
    expect(session.lo).toBe(5);
    expect(session.lowerWork?.workId).toBe("w5");
    expect(session.comparisons).toBe(1);
    expect(session.pivot?.score).toBe(7);

    session = answerComparison(session, "less");
    expect(session.hi).toBe(7);
    expect(session.upperWork?.workId).toBe("w7");
    expect(session.pivot?.score).toBe(6);

    session = answerComparison(session, "less");
    expect(session.result).toMatchObject({
      kind: "converged",
      suggestedScore: 5.5,
    });
    expect(session.result?.lowerWork?.workId).toBe("w5");
    expect(session.result?.upperWork?.workId).toBe("w6");
  });

  it("finishes immediately at the pivot's score on 'about the same'", () => {
    let session = startSession(target(), [candidate("a", 7.3)]);
    session = answerComparison(session, "same");
    expect(session.result?.kind).toBe("matched");
    expect(session.result?.suggestedScore).toBe(7.5);
    expect(session.result?.matchedWork?.workId).toBe("a");
  });

  it("discards a skipped pivot without narrowing or counting", () => {
    let session = startSession(target(), ladder());
    session = answerComparison(session, "skip");
    expect(session.comparisons).toBe(0);
    expect(session.lo).toBe(0);
    expect(session.hi).toBe(10);
    expect(session.askedWorkIds).toContain("w5");
    expect(session.pivot?.workId).not.toBe("w5");
    expect(session.pivot).toBeDefined();
  });

  it("never re-offers works scored the same as an answered pivot", () => {
    const dupes = [0, 1, 2, 3, 4].map((n) => candidate(`w${n}`, 7));
    let session = startSession(target(), dupes);
    session = answerComparison(session, "more");
    expect(session.result).toMatchObject({
      kind: "aboveAll",
      suggestedScore: 7.5,
    });
  });
});

describe("termination and suggestions", () => {
  it("terminates within MAX_COMPARISONS without repeating pivots, whatever the user answers", () => {
    const pool = [
      0, 1, 2, 3, 3.3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.7, 8, 9, 10,
    ].map((score, i) => candidate(`w${i}`, score));
    for (const answer of ["more", "less", "skip", "same"] as const) {
      let session = startSession(target(), pool);
      const seen = new Set<string>();
      let guard = 0;
      while (session.pivot !== undefined && guard < 100) {
        expect(seen.has(session.pivot.workId)).toBe(false);
        seen.add(session.pivot.workId);
        session = answerComparison(session, answer);
        guard++;
      }
      expect(session.result).toBeDefined();
      expect(session.comparisons).toBeLessThanOrEqual(MAX_COMPARISONS);
    }
  });

  it("rounds the converged midpoint to the nearest half", () => {
    let session = startSession(target(), [
      candidate("a", 6),
      candidate("b", 8.5),
    ]);
    session = answerComparison(session, "more"); // pivot a (6)
    session = answerComparison(session, "less"); // pivot b (8.5)
    // Bracket (6, 8.5) -> midpoint 7.25 -> 7.5
    expect(session.result).toMatchObject({
      kind: "converged",
      suggestedScore: 7.5,
    });
  });

  it("suggests just above the top-rated work, capped at 10", () => {
    let session = startSession(target(), [candidate("a", 9.8)]);
    session = answerComparison(session, "more");
    expect(session.result).toMatchObject({
      kind: "aboveAll",
      suggestedScore: 10,
    });
    expect(session.result?.lowerWork?.workId).toBe("a");
  });

  it("suggests just below the lowest-rated work, floored at 0", () => {
    let low = startSession(target(), [candidate("a", 2)]);
    low = answerComparison(low, "less");
    expect(low.result).toMatchObject({ kind: "belowAll", suggestedScore: 1.5 });

    let floor = startSession(target(), [candidate("a", 0.2)]);
    floor = answerComparison(floor, "less");
    expect(floor.result).toMatchObject({ kind: "belowAll", suggestedScore: 0 });
  });

  it("falls back to the scale midpoint when every pivot is skipped", () => {
    let session = startSession(target(), [
      candidate("a", 3),
      candidate("b", 8),
    ]);
    session = answerComparison(session, "skip");
    session = answerComparison(session, "skip");
    expect(session.result).toMatchObject({
      kind: "converged",
      suggestedScore: 5,
    });
    expect(session.result?.lowerWork).toBeUndefined();
    expect(session.result?.upperWork).toBeUndefined();
  });

  it("resolves immediately for an empty pool", () => {
    const session = startSession(target(), []);
    expect(session.pivot).toBeUndefined();
    expect(session.result).toMatchObject({
      kind: "converged",
      suggestedScore: 5,
    });
  });
});

describe("workSimilarity", () => {
  it("weights a shared director above shared genres", () => {
    const t = movieData({
      directors: ["Nolan"],
      genres: ["Drama", "Thriller"],
    });
    expect(
      workSimilarity(WorkType.movie, t, movieData({ directors: ["Nolan"] })),
    ).toBe(3);
    expect(
      workSimilarity(
        WorkType.movie,
        t,
        movieData({ genres: ["Drama", "Thriller"] }),
      ),
    ).toBe(2);
    expect(
      workSimilarity(
        WorkType.movie,
        t,
        movieData({ directors: ["Nolan"], genres: ["Drama"] }),
      ),
    ).toBe(4);
  });

  it("matches book authors and subjects case-insensitively", () => {
    const t = bookData({
      authors: ["Ursula K. Le Guin"],
      subjects: ["Science Fiction"],
    });
    expect(
      workSimilarity(
        WorkType.book,
        t,
        bookData({ subjects: ["science fiction"] }),
      ),
    ).toBe(1);
    expect(
      workSimilarity(
        WorkType.book,
        t,
        bookData({ authors: ["Ursula K. Le Guin"] }),
      ),
    ).toBe(3);
  });

  it("scores 0 for missing or mismatched metadata", () => {
    expect(workSimilarity(WorkType.movie, undefined, movieData())).toBe(0);
    expect(workSimilarity(WorkType.movie, movieData(), bookData())).toBe(0);
    expect(workSimilarity(WorkType.book, bookData(), undefined)).toBe(0);
  });
});
