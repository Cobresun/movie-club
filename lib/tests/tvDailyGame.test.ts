import { rankPool } from "../dailyGame";
import { tvDailyGameRules } from "../tv/dailyGame";
import { type TvDataSummary } from "../types/tv";

const names = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);

const show = (overrides: Partial<TvDataSummary> = {}): TvDataSummary => ({
  kind: "tv",
  level: "show",
  showId: "0",
  showTitle: "Show",
  title: "Show",
  genres: [],
  creators: [],
  networks: [],
  castNames: [],
  ...overrides,
});

/** Ranks `shows` against the first, which is the answer. */
const rank = (shows: Record<string, TvDataSummary>) =>
  rankPool(
    Object.keys(shows)[0] ?? "",
    Object.entries(shows).map(([title, data]) => ({ id: title, title, data })),
    tvDailyGameRules,
  );

const cluesOf = (ranking: ReturnType<typeof rank>, title: string) =>
  ranking.find((work) => work.title === title)?.clues;

/** Other shows in the pool, so it is big enough for the tags under test to be rare. */
const filler = (count: number, overrides: Partial<TvDataSummary> = { genres: ["Reality"] }) =>
  Object.fromEntries(names("Filler", count).map((title) => [title, show(overrides)]));

describe("TV daily-game clues", () => {
  it("names a shared creator as the strongest clue, above shared stars", () => {
    const ranking = rank({
      Answer: show({ creators: ["Vince Gilligan", "Peter Gould"], castNames: ["Bob Odenkirk"] }),
      "Shares the stars": show({ castNames: ["Bob Odenkirk"] }),
      "Shares the creator": show({ creators: ["Vince Gilligan"] }),
      ...filler(4),
    });

    expect(ranking.map((work) => work.title).slice(0, 3)).toStrictEqual([
      "Answer",
      "Shares the creator",
      "Shares the stars",
    ]);
    expect(cluesOf(ranking, "Shares the creator")).toStrictEqual([
      { text: "Same creator: Vince Gilligan", shared: true },
    ]);
  });

  it("counts the regulars a show's credits lead with, not a guest from one episode", () => {
    const ranking = rank({
      Answer: show({ castNames: ["Lead", ...names("Regular", 7), "Guest Star"] }),
      "Shares a guest": show({ castNames: [...names("Other regular", 8), "Guest Star"] }),
      "Shares the lead": show({ castNames: [...names("Other regular", 7), "Lead"] }),
      ...filler(4),
    });

    expect(cluesOf(ranking, "Shares the lead")).toStrictEqual([
      { text: "Also stars Lead", shared: true },
    ]);
    expect(cluesOf(ranking, "Shares a guest")).toStrictEqual([]);
  });

  it("names a shared network and the decade both shows premiered in", () => {
    const ranking = rank({
      Answer: show({ networks: ["AMC"], airDate: "2015-02-08T00:00:00.000Z" }),
      Guess: show({ networks: ["AMC"], airDate: "2019-06-01T00:00:00.000Z" }),
      "Year before": show({ airDate: "2009-12-01T00:00:00.000Z" }),
      ...filler(6, { airDate: "1995-01-01T00:00:00.000Z" }),
    });

    expect(cluesOf(ranking, "Guess")).toStrictEqual([
      { text: "Also on AMC", shared: true },
      { text: "Also premiered in the 2010s", shared: true },
    ]);
    expect(cluesOf(ranking, "Year before")).toStrictEqual([]);
  });

  it("ranks a guess with the answer's genres above one with the same genres and more", () => {
    const ranking = rank({
      Answer: show({ genres: ["Crime", "Drama"] }),
      "Crime drama comedy": show({ genres: ["Crime", "Drama", "Comedy"] }),
      "Crime drama": show({ genres: ["Crime", "Drama"] }),
      ...filler(4),
    });

    expect(ranking.map((work) => work.title).slice(0, 3)).toStrictEqual([
      "Answer",
      "Crime drama",
      "Crime drama comedy",
    ]);
    expect(cluesOf(ranking, "Crime drama comedy")).toContainEqual({
      text: "Not Comedy",
      shared: false,
    });
  });

  it("only draws an answer that has a creator to lead players to it", () => {
    expect(tvDailyGameRules.canBeAnswer(show({ creators: ["Vince Gilligan"] }))).toBe(true);
    expect(tvDailyGameRules.canBeAnswer(show())).toBe(false);
  });
});
