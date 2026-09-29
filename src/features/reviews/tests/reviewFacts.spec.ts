import { describe, expect, it } from "vitest";

import { isDefined } from "../../../../lib/checks/checks";
import { isMajorCastMember } from "../../../../lib/movie/majorCast";
import { DetailedBookData } from "../../../../lib/types/book";
import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem, DetailedWorkData, Review } from "../../../../lib/types/lists";
import { DetailedMovieData } from "../../../../lib/types/movie";
import { computeReviewFact } from "../reviewFacts";

const MEMBER_A = "member-a";
const MEMBER_B = "member-b";
const MEMBER_C = "member-c";
const MEMBERS = [
  { id: MEMBER_A, name: "Alice" },
  { id: MEMBER_B, name: "Bob" },
  { id: MEMBER_C, name: "Casey" },
];

function movieData(
  opts: {
    directors?: string[];
    // Billing order = array order. `popularity` is optional and only set when a
    // test needs to exercise the star path in lib/movie/majorCast.
    actors?: { name: string; popularity?: number }[];
    genres?: string[];
    voteAverage?: number;
    runtime?: number;
    releaseDate?: string;
  } = {},
): DetailedMovieData {
  const cast = opts.actors ?? [];
  const actorNames = cast.map((c) => c.name);
  return {
    kind: "movie",
    castNames: actorNames,
    // Mirror the server's major-cast filtering (lib/movie/majorCast) so
    // reviewFacts sees the same pre-filtered shape it does in production.
    majorCastNames: cast.filter((c, i) => isMajorCastMember(i, c.popularity)).map((c) => c.name),
    actors: actorNames.map((name) => ({
      name,
      character: null,
      profilePath: null,
    })),
    directors: (opts.directors ?? []).map((name) => ({
      name,
      profilePath: null,
    })),
    genres: opts.genres ?? [],
    production_companies: [],
    production_countries: [],
    vote_average: opts.voteAverage,
    runtime: opts.runtime,
    release_date: opts.releaseDate,
  };
}

function bookData(
  opts: {
    authors?: string[];
    pages?: number;
    firstPublishYear?: number;
  } = {},
): DetailedBookData {
  return {
    kind: "book",
    title: "A Book",
    authors: opts.authors ?? [],
    subjects: [],
    numberOfPages: opts.pages,
    firstPublishYear: opts.firstPublishYear,
  };
}

/** A review-list work whose club average is derived from the member scores. */
function work(
  id: string,
  date: string,
  memberScores: Record<string, number>,
  opts: { externalData?: DetailedWorkData; type?: WorkType } = {},
): DetailedReviewListItem {
  const scores: Record<string, Review> = {};
  const values = Object.values(memberScores);
  for (const [memberId, score] of Object.entries(memberScores)) {
    scores[memberId] = {
      id: `review-${id}-${memberId}`,
      created_date: date,
      score,
    };
  }
  if (values.length > 0) {
    scores.average = {
      id: `avg-${id}`,
      created_date: date,
      score: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }
  return {
    id,
    type: opts.type ?? WorkType.movie,
    title: `Work ${id}`,
    createdDate: date,
    scores,
    externalData: opts.externalData,
  };
}

/** Both members score, roughly a month apart per index — spaced out so no
 * incidental weekly streak or same-year record sneaks into a test. */
function filler(
  count: number,
  opts: {
    startYear?: number;
    scoreOf?: (i: number) => number;
    movie?: Parameters<typeof movieData>[0];
    book?: Parameters<typeof bookData>[0];
  } = {},
): DetailedReviewListItem[] {
  const startYear = opts.startYear ?? 2020;
  return Array.from({ length: count }, (_, i) => {
    const year = startYear + Math.floor(i / 6);
    const month = ((i * 2) % 12) + 1;
    const score = opts.scoreOf?.(i) ?? 5 + (i % 3);
    return work(
      `filler-${i}`,
      `${year}-${String(month).padStart(2, "0")}-03T12:00:00.000Z`,
      { [MEMBER_A]: score, [MEMBER_B]: score },
      isDefined(opts.book)
        ? { type: WorkType.book, externalData: bookData(opts.book) }
        : { externalData: movieData({ genres: ["Drama"], ...opts.movie }) },
    );
  });
}

describe("computeReviewFact", () => {
  it("surfaces a fact even when only some members have scored", () => {
    // Book-club reality: not everyone reviews every work, so we don't gate on
    // a full house — a single score is enough to unlock a fact.
    const target = work("t", "2025-06-01T12:00:00.000Z", { [MEMBER_A]: 10 });
    const reviews = [...filler(11), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.kind).toBe("allTimeHigh");
  });

  it("returns undefined when the target has no score", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {});
    const reviews = [...filler(12), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)).toBeUndefined();
  });

  it("returns undefined for an unremarkable review", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 5,
      [MEMBER_B]: 6,
    });
    const reviews = [...filler(3), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)).toBeUndefined();
  });

  it("crowns an all-time high once the club has enough history", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 9,
      [MEMBER_B]: 10,
    });
    const reviews = [...filler(11), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("allTimeHigh");
    expect(fact?.text).toContain("highest-rated movie in club history");
    expect(fact?.text).toContain("9.5");
  });

  it("flags an all-time low", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 1,
      [MEMBER_B]: 2,
    });
    const reviews = [...filler(11), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.kind).toBe("allTimeLow");
  });

  it("prefers an all-time record over a coinciding count milestone", () => {
    // Target is both the 10th work and the highest-rated ever.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 10,
      [MEMBER_B]: 10,
    });
    const reviews = [...filler(9), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.kind).toBe("allTimeHigh");
  });

  it("marks the club's 10th review as a milestone", () => {
    // Mid-pack average so no record outranks the milestone.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 6,
      [MEMBER_B]: 6,
    });
    const reviews = [...filler(9), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("clubMilestone");
    expect(fact?.text).toContain("10th movie");
  });

  it("calls out the most divisive pick in club history", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 2,
      [MEMBER_B]: 8,
    });
    // 11 works total so the target isn't a count milestone.
    const reviews = [...filler(10), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("divisive");
    expect(fact?.text).toContain("most divisive");
  });

  it("finds the highest-rated review of the year", () => {
    const sameYear = Array.from({ length: 5 }, (_, i) =>
      work(
        `y-${i}`,
        `2025-0${i + 1}-15T12:00:00.000Z`,
        { [MEMBER_A]: 5, [MEMBER_B]: 6 },
        { externalData: movieData() },
      ),
    );
    const target = work("t", "2025-06-20T12:00:00.000Z", {
      [MEMBER_A]: 8,
      [MEMBER_B]: 9,
    });

    const fact = computeReviewFact([...sameYear, target], "t", MEMBERS);
    expect(fact?.kind).toBe("yearHigh");
    expect(fact?.text).toContain("2025");
  });

  it("spots the best film yet from a repeat director", () => {
    const byNolan = (id: string, date: string, score: number) =>
      work(
        id,
        date,
        { [MEMBER_A]: score, [MEMBER_B]: score },
        { externalData: movieData({ directors: ["Christopher Nolan"] }) },
      );
    const reviews = [
      byNolan("n-1", "2024-01-10T12:00:00.000Z", 7),
      byNolan("n-2", "2024-04-10T12:00:00.000Z", 6),
      work("other", "2024-08-10T12:00:00.000Z", {
        [MEMBER_A]: 8,
        [MEMBER_B]: 8,
      }),
      byNolan("t", "2025-02-10T12:00:00.000Z", 7.5),
    ];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("personHigh");
    expect(fact?.text).toContain("3 films directed by Christopher Nolan");
  });

  it("counts an actor milestone", () => {
    const withHanks = (id: string, date: string, score: number) =>
      work(
        id,
        date,
        { [MEMBER_A]: score, [MEMBER_B]: score + 1 },
        { externalData: movieData({ actors: [{ name: "Tom Hanks" }] }) },
      );
    // Four prior Hanks movies across two years (so no year record), target is
    // the 5th. Distinct scores avoid records; 5th position isn't a milestone.
    const reviews = [
      withHanks("h-1", "2024-01-10T12:00:00.000Z", 3),
      withHanks("h-2", "2024-05-10T12:00:00.000Z", 8),
      withHanks("h-3", "2024-09-10T12:00:00.000Z", 5),
      withHanks("h-4", "2025-01-10T12:00:00.000Z", 6),
      withHanks("t", "2025-06-10T12:00:00.000Z", 5),
    ];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("actorMilestone");
    expect(fact?.text).toContain("5th movie");
    expect(fact?.text).toContain("Tom Hanks");
  });

  it("ignores a bit-part actor buried deep in the cast", () => {
    // Five distinct top-billed actors ahead of Hanks (with no popularity) push
    // him out of the major cast, so his fifth appearance shouldn't surface a
    // "familiar face" milestone. The leads differ per movie so none recur.
    const withMinorHanks = (id: string, date: string, score: number) =>
      work(
        id,
        date,
        { [MEMBER_A]: score, [MEMBER_B]: score + 1 },
        {
          externalData: movieData({
            actors: [
              { name: `${id}-1` },
              { name: `${id}-2` },
              { name: `${id}-3` },
              { name: `${id}-4` },
              { name: `${id}-5` },
              { name: "Tom Hanks" },
            ],
          }),
        },
      );
    const reviews = [
      withMinorHanks("h-1", "2024-01-10T12:00:00.000Z", 3),
      withMinorHanks("h-2", "2024-05-10T12:00:00.000Z", 8),
      withMinorHanks("h-3", "2024-09-10T12:00:00.000Z", 5),
      withMinorHanks("h-4", "2025-01-10T12:00:00.000Z", 6),
      withMinorHanks("t", "2025-06-10T12:00:00.000Z", 5),
    ];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).not.toBe("actorMilestone");
  });

  it("counts a recognizable star billed just outside the top-billed slice", () => {
    // A big ensemble bills five leads ahead of Holland, so billing alone would
    // drop him — but his high popularity keeps him in the major cast, so his
    // fifth appearance still surfaces a "familiar face" milestone. Uses a
    // realistic popularity (~13, his measured TMDB value in Civil War).
    const withStarHolland = (id: string, date: string, score: number) =>
      work(
        id,
        date,
        { [MEMBER_A]: score, [MEMBER_B]: score + 1 },
        {
          externalData: movieData({
            actors: [
              { name: `${id}-1` },
              { name: `${id}-2` },
              { name: `${id}-3` },
              { name: `${id}-4` },
              { name: `${id}-5` },
              { name: "Tom Holland", popularity: 13 },
            ],
          }),
        },
      );
    const reviews = [
      withStarHolland("h-1", "2024-01-10T12:00:00.000Z", 3),
      withStarHolland("h-2", "2024-05-10T12:00:00.000Z", 8),
      withStarHolland("h-3", "2024-09-10T12:00:00.000Z", 5),
      withStarHolland("h-4", "2025-01-10T12:00:00.000Z", 6),
      withStarHolland("t", "2025-06-10T12:00:00.000Z", 5),
    ];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("actorMilestone");
    expect(fact?.text).toContain("5th movie");
    expect(fact?.text).toContain("Tom Holland");
  });

  it("notices the club's first movie in a genre", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { externalData: movieData({ genres: ["Romance"] }) },
    );
    // 11 prior works (all Drama), so position 12 isn't a milestone and the
    // first-genre history threshold is met.
    const reviews = [...filler(11), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("firstGenre");
    expect(fact?.text).toContain("first Romance movie");
  });

  it("flags a big deviation from the TMDB rating", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 4, [MEMBER_B]: 4 },
      { externalData: movieData({ voteAverage: 8 }) },
    );
    const reviews = [...filler(3), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("tmdbDeviation");
    expect(fact?.text).toContain("4 points lower");
  });

  it("celebrates crossing a full day of combined watch time", () => {
    // 11 priors at 2h06m each = 23.1h; the 90m target tips the club past 24h.
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { externalData: movieData({ runtime: 90 }) },
    );
    const reviews = [...filler(11, { movie: { runtime: 126 } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("watchTimeMilestone");
    expect(fact?.text).toContain("24 hours");
    expect(fact?.text).toContain("a full day on the couch");
  });

  it("crowns the longest movie the club has sat through", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { externalData: movieData({ runtime: 200 }) },
    );
    // 11 priors at 100m keep the combined runtime under every couch-time
    // milestone, so the runtime record is the fact that fires.
    const reviews = [...filler(11, { movie: { runtime: 100 } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("longestRuntime");
    expect(fact?.text).toContain("3h 20m");
    expect(fact?.text).toContain("longest movie");
  });

  it("time-travels to the oldest release in club history", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { externalData: movieData({ releaseDate: "1954-03-15" }) },
    );
    const reviews = [...filler(11, { movie: { releaseDate: "1990-05-01" } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("timeTravel");
    expect(fact?.text).toContain("Released in 1954");
    expect(fact?.text).toContain("oldest movie");
  });

  it("notices the club's first trip to a decade", () => {
    // Priors are all from the 60s, so the 1975 target opens a new decade
    // without being the oldest movie (which would outrank it).
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { externalData: movieData({ releaseDate: "1975-06-20" }) },
    );
    const reviews = [...filler(11, { movie: { releaseDate: "1965-01-01" } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("decadeFirst");
    expect(fact?.text).toContain("first trip to the 1970s");
  });

  it("celebrates crossing a page-count milestone, in War and Peace units", () => {
    // 11 priors at 420 pages = 4,620; the 500-page target crosses 5,000.
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { type: WorkType.book, externalData: bookData({ pages: 500 }) },
    );
    const reviews = [...filler(11, { book: { pages: 420 } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("pagesMilestone");
    expect(fact?.text).toContain("5,000 pages");
    expect(fact?.text).toContain("4 copies of War and Peace");
  });

  it("crowns the longest book the club has conquered", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      { type: WorkType.book, externalData: bookData({ pages: 1178 }) },
    );
    // 11 priors at 300 pages keep total pages under the 5,000 milestone.
    const reviews = [...filler(11, { book: { pages: 300 } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("longestBook");
    expect(fact?.text).toContain("1,178 pages");
    expect(fact?.text).toContain("longest book");
  });

  it("time-travels to the oldest publication in club history", () => {
    const target = work(
      "t",
      "2025-06-01T12:00:00.000Z",
      { [MEMBER_A]: 6, [MEMBER_B]: 6 },
      {
        type: WorkType.book,
        externalData: bookData({ firstPublishYear: 1847 }),
      },
    );
    const reviews = [...filler(11, { book: { firstPublishYear: 1990 } }), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("timeTravel");
    expect(fact?.text).toContain("First published in 1847");
    expect(fact?.text).toContain("oldest book");
  });

  it("spots the best book yet from a repeat author", () => {
    const byAuthor = (id: string, date: string, score: number) =>
      work(
        id,
        date,
        { [MEMBER_A]: score, [MEMBER_B]: score },
        {
          type: WorkType.book,
          externalData: bookData({ authors: ["Ursula K. Le Guin"] }),
        },
      );
    const reviews = [
      byAuthor("b-1", "2024-01-10T12:00:00.000Z", 7),
      byAuthor("b-2", "2024-04-10T12:00:00.000Z", 6),
      byAuthor("t", "2025-02-10T12:00:00.000Z", 8),
    ];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("personHigh");
    expect(fact?.text).toContain("3 books by Ursula K. Le Guin");
  });

  it("skips score facts while scores are hidden, falling back to a score-free one", () => {
    // Both the 10th work and the highest-rated ever: hidden, only the milestone remains.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 10,
      [MEMBER_B]: 10,
    });
    const reviews = [...filler(9), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS, { hideScores: true });
    expect(fact?.kind).toBe("clubMilestone");
  });
});

describe("computeReviewFact member facts", () => {
  it("names who gave the club's first perfect 10", () => {
    // A 9 in the history keeps the target (avg 8.5) off the all-time record.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 10,
      [MEMBER_B]: 7,
    });
    const reviews = [...filler(10, { scoreOf: (i) => (i === 0 ? 9 : 6) }), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.text).toBe(
      "The first perfect 10 in club history, from Alice.",
    );
  });

  it("counts the 3rd perfect 10", () => {
    // Both members gave the first filler a 10, so the target's is the 3rd.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 7,
      [MEMBER_B]: 10,
    });
    const reviews = [...filler(10, { scoreOf: (i) => (i === 0 ? 10 : 6) }), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.text).toBe(
      "Only the 3rd perfect 10 in club history, from Bob.",
    );
  });

  it("stops counting perfect 10s once they're no longer rare", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 7,
      [MEMBER_B]: 10,
    });
    const reviews = [...filler(10, { scoreOf: (i) => (i < 2 ? 10 : 6) }), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.kind).not.toBe("perfectScore");
  });

  it("calls a unanimous score", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 7,
      [MEMBER_B]: 7,
      [MEMBER_C]: 7,
    });
    const reviews = [...filler(3), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("unanimous");
    expect(fact?.text).toBe("All 3 members scored it exactly 7.");
  });

  it("doesn't call two matching scores unanimous", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 7,
      [MEMBER_B]: 7,
    });
    const reviews = [...filler(3), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)).toBeUndefined();
  });

  it("celebrates a member's new personal best", () => {
    // Filler scores run 5–7, so Alice's 8 beats all 20 of hers while the
    // club average (7) stays level with the all-time high.
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 8,
      [MEMBER_B]: 6,
    });
    const reviews = [...filler(20), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("personalBest");
    expect(fact?.text).toBe("A new high for Alice: 8, above all 20 of their earlier scores.");
  });

  it("marks a member's new personal low", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 6,
      [MEMBER_B]: 4,
    });
    const reviews = [...filler(20), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("personalLow");
    expect(fact?.text).toBe("A new low for Bob: 4, below all 20 of their earlier scores.");
  });

  it("waits for a longer history before calling a personal record", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 8,
      [MEMBER_B]: 6,
    });
    const reviews = [...filler(19), target];

    expect(computeReviewFact(reviews, "t", MEMBERS)?.kind).not.toBe("personalBest");
  });

  it("singles out a lone wolf far from everyone else", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 2,
      [MEMBER_B]: 7,
      [MEMBER_C]: 8,
    });
    const reviews = [...filler(3), target];

    const fact = computeReviewFact(reviews, "t", MEMBERS);
    expect(fact?.kind).toBe("loneWolf");
    expect(fact?.text).toBe("Alice's 2 was 5 points below anyone else's.");
  });

  it("leaves out a lone wolf who is no longer in the club", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 2,
      [MEMBER_B]: 7,
      [MEMBER_C]: 8,
    });
    const reviews = [...filler(3), target];
    const withoutAlice = MEMBERS.filter((member) => member.id !== MEMBER_A);

    expect(computeReviewFact(reviews, "t", withoutAlice)).toBeUndefined();
  });

  it("keeps a lone wolf's score hidden until scores are revealed", () => {
    const target = work("t", "2025-06-01T12:00:00.000Z", {
      [MEMBER_A]: 2,
      [MEMBER_B]: 7,
      [MEMBER_C]: 8,
    });
    const reviews = [...filler(3), target];

    expect(computeReviewFact(reviews, "t", MEMBERS, { hideScores: true })).toBeUndefined();
  });
});
