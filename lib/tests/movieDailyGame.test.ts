import { rankPool } from "../dailyGame";
import { movieDailyGameRules } from "../movie/dailyGame";
import { type MovieDataSummary } from "../types/movie";

const credits = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

const movie = (castNames: string[], majorCastNames: string[]): MovieDataSummary => ({
  kind: "movie",
  castNames,
  majorCastNames,
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
});

describe("rankPool for movies", () => {
  it("ranks a movie sharing the answer's lead above one sharing only a bit-part", () => {
    const answer = movie(
      ["Lead Star", ...credits("Answer extra", 40), "Stunt Double"],
      ["Lead Star"],
    );
    const sharesLead = movie(["Lead Star", ...credits("Ensemble extra", 40)], ["Lead Star"]);
    const sharesExtra = movie(
      [...credits("Indie lead", 3), "Stunt Double"],
      credits("Indie lead", 3),
    );

    const ranking = rankPool(
      "answer",
      [
        { id: "answer", title: "Answer", data: answer },
        { id: "extra", title: "Shares an extra", data: sharesExtra },
        { id: "lead", title: "Shares the lead", data: sharesLead },
      ],
      movieDailyGameRules,
    );

    expect(ranking.map((work) => work.title)).toStrictEqual([
      "Answer",
      "Shares the lead",
      "Shares an extra",
    ]);
  });
});

const film = (overrides: Partial<MovieDataSummary> = {}): MovieDataSummary => ({
  ...movie([], []),
  ...overrides,
});

const director = (name: string) => ({ name, profilePath: null });

/** Ranks `works` against the first, which is the answer. */
const rank = (works: Record<string, MovieDataSummary>) =>
  rankPool(
    Object.keys(works)[0] ?? "",
    Object.entries(works).map(([title, data]) => ({ id: title, title, data })),
    movieDailyGameRules,
  );

const cluesOf = (ranking: ReturnType<typeof rank>, title: string) =>
  ranking.find((work) => work.title === title)?.clues;

describe("movie daily-game clues", () => {
  it("ranks only by clues the player sees, so two guesses with none tie on title", () => {
    const ranking = rank({
      Answer: film({ original_language: "en", release_date: "1995-01-01" }),
      // Same language as the answer and most of the pool, and decades apart: no clue.
      Zulu: film({ original_language: "en", release_date: "1960-01-01" }),
      Alpha: film({ original_language: "fr", release_date: "1930-01-01" }),
      Bravo: film({ original_language: "en", release_date: "1940-01-01" }),
    });

    expect(ranking.map((work) => [work.title, work.clues])).toStrictEqual([
      ["Answer", []],
      ["Alpha", []],
      ["Bravo", []],
      ["Zulu", []],
    ]);
  });

  it("never ranks a guess below one whose clues it has all of", () => {
    const answer = film({ genres: ["Western", "Drama"], production_companies: ["Small Studio"] });
    const ranking = rank({
      Answer: answer,
      "Shares genre": film({ genres: ["Western"] }),
      // Its long genre list would dilute an overlap ratio; here it only adds clues.
      "Shares genre and studio": film({
        genres: ["Western", "Comedy", "Horror", "Family", "War"],
        production_companies: ["Small Studio", "Other"],
      }),
      ...Object.fromEntries(credits("Filler", 4).map((title) => [title, film()])),
    });

    expect(ranking.map((work) => work.title).slice(0, 3)).toStrictEqual([
      "Answer",
      "Shares genre and studio",
      "Shares genre",
    ]);
  });

  it("drops what most of the pool shares and weighs rarer ties higher", () => {
    const ranking = rank({
      Answer: film({ genres: ["Drama", "Western"], original_language: "ko" }),
      Guess: film({ genres: ["Drama", "Western"], original_language: "ko" }),
      Other: film({ genres: ["Drama"], original_language: "en" }),
      Another: film({ genres: ["Drama"], original_language: "en" }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Western", strength: "weak" },
      { text: "Also in Korean", strength: "weak" },
    ]);
  });

  it("names a shared director as the strongest clue, and how near the release years are", () => {
    const ranking = rank({
      Answer: film({ directors: [director("Ann Director")], release_date: "2000-05-01" }),
      Guess: film({ directors: [director("Ann Director")], release_date: "2002-05-01" }),
      Later: film({ release_date: "2008-05-01" }),
      Same: film({ release_date: "2000-01-01" }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Same director: Ann Director", strength: "strong" },
      { text: "Released within 3 years", strength: "medium" },
    ]);
    expect(cluesOf(ranking, "Later")).toStrictEqual([
      { text: "Released within 10 years", strength: "weak" },
    ]);
    expect(cluesOf(ranking, "Same")).toStrictEqual([
      { text: "Released the same year", strength: "medium" },
    ]);
  });
});
