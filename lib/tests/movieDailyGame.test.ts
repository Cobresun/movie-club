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
