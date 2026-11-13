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

/** Other movies in the pool, so it is big enough for the tags under test to be rare. */
const filler = (count: number, overrides: Partial<MovieDataSummary> = { genres: ["Horror"] }) =>
  Object.fromEntries(credits("Filler", count).map((title) => [title, film(overrides)]));

describe("movie daily-game clues", () => {
  it("ranks only by clues the player sees, then by the nearer release year", () => {
    const ranking = rank({
      Answer: film({ original_language: "en", release_date: "1995-01-01" }),
      // English is most of the pool, so it is no clue; neither year shares the 1990s.
      Zulu: film({ original_language: "en", release_date: "1988-01-01" }),
      Alpha: film({ original_language: "en", release_date: "1960-01-01" }),
      Bravo: film({ original_language: "fr", release_date: "1960-01-01" }),
    });

    expect(ranking.map((work) => [work.title, work.clues])).toStrictEqual([
      ["Answer", []],
      ["Zulu", []],
      ["Alpha", []],
      ["Bravo", []],
    ]);
  });

  it("ranks a guess with the answer's genres above one with the same genres and more", () => {
    const ranking = rank({
      Answer: film({ genres: ["Romance"] }),
      "Romance, Action and Comedy": film({ genres: ["Romance", "Action", "Comedy"] }),
      "Just Romance": film({ genres: ["Romance"] }),
      ...filler(4),
    });

    expect(ranking.map((work) => work.title).slice(0, 3)).toStrictEqual([
      "Answer",
      "Just Romance",
      "Romance, Action and Comedy",
    ]);
    expect(cluesOf(ranking, "Romance, Action and Comedy")).toStrictEqual([
      { text: "Romance", points: 2 },
      { text: "Not Action, Comedy", points: -2 },
    ]);
  });

  it("ranks a guess with one genre to spare above one that is missing a genre", () => {
    const ranking = rank({
      Answer: film({ genres: ["Romance", "Comedy", "Drama", "Science Fiction"] }),
      "Missing one": film({ genres: ["Romance", "Comedy", "Drama"] }),
      "One to spare": film({ genres: ["Romance", "Comedy", "Drama", "Science Fiction", "War"] }),
      "Just Romance": film({ genres: ["Romance"] }),
      ...filler(4),
    });

    expect(ranking.map((work) => work.title).slice(0, 4)).toStrictEqual([
      "Answer",
      "One to spare",
      "Missing one",
      "Just Romance",
    ]);
  });

  it("drops what most of the pool shares", () => {
    const ranking = rank({
      Answer: film({ genres: ["Drama", "Western"], original_language: "ko" }),
      Guess: film({ genres: ["Drama", "Western"], original_language: "ko" }),
      English: film({ genres: ["Drama"], original_language: "en" }),
      ...filler(30, { genres: ["Drama"], original_language: "en" }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Western", points: 3 },
      { text: "Also in Korean", points: 3 },
    ]);
    expect(cluesOf(ranking, "English")).toStrictEqual([]);
  });

  it("counts a studio only when it has films enough for a style, and isn't a major", () => {
    const studio = (...production_companies: string[]) => film({ production_companies });
    const ranking = rank({
      Answer: studio("Small Studio", "Co-financier", "Major"),
      Guess: studio("Small Studio", "Co-financier", "Major"),
      ...Object.fromEntries(credits("Small", 4).map((title) => [title, studio("Small Studio")])),
      ...Object.fromEntries(credits("Major", 20).map((title) => [title, studio("Major")])),
      ...filler(200, {}),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Same studio: Small Studio", points: 2 },
    ]);
  });

  it("counts a directing team once, and all shared stars as one clue", () => {
    const team = [director("Lana Wachowski"), director("Lilly Wachowski")];
    const ranking = rank({
      Answer: film({ directors: team, majorCastNames: ["Keanu Reeves", "Carrie-Anne Moss"] }),
      Guess: film({ directors: team, majorCastNames: ["Keanu Reeves", "Carrie-Anne Moss"] }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Same director: Lana Wachowski & Lilly Wachowski", points: 10 },
      { text: "Also stars Keanu Reeves, Carrie-Anne Moss", points: 10 },
    ]);
  });

  it("names a shared director as the strongest clue, and a shared decade but not a nearby year", () => {
    const ranking = rank({
      Answer: film({ directors: [director("Ann Director")], release_date: "2000-05-01" }),
      Guess: film({ directors: [director("Ann Director")], release_date: "2008-05-01" }),
      "Year before": film({ release_date: "1999-12-01" }),
      Sixties: film({ release_date: "1965-01-01" }),
      Seventies: film({ release_date: "1975-01-01" }),
      Eighties: film({ release_date: "1985-01-01" }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Same director: Ann Director", points: 10 },
      { text: "Also from the 2000s", points: 1 },
    ]);
    expect(cluesOf(ranking, "Year before")).toStrictEqual([]);
  });
});
