import { rankPool } from "../dailyGame";
import { movieDailyGameRules } from "../movie/dailyGame";
import { type MovieDataSummary } from "../types/movie";

const credits = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

const movie = (majorCastNames: string[]): MovieDataSummary => ({
  kind: "movie",
  majorCastNames,
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
});

describe("rankPool for movies", () => {
  it("ranks a movie sharing the answer's lead above one sharing no one", () => {
    const answer = movie(["Lead Star", ...credits("Answer lead", 3)]);
    const sharesLead = movie(["Lead Star", ...credits("Ensemble lead", 3)]);
    const sharesNoOne = movie(credits("Indie lead", 3));

    const ranking = rankPool(
      "answer",
      [
        { id: "answer", title: "Answer", data: answer },
        { id: "none", title: "Shares no one", data: sharesNoOne },
        { id: "lead", title: "Shares the lead", data: sharesLead },
      ],
      movieDailyGameRules,
    );

    expect(ranking.map((work) => work.title)).toStrictEqual([
      "Answer",
      "Shares the lead",
      "Shares no one",
    ]);
  });
});
