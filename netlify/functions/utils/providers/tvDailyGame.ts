import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { tvDailyGameRules } from "../../../../lib/tv/dailyGame.js";
import { type TvDataSummary } from "../../../../lib/types/tv";
import { topWorkIds } from "../dailyGame";
import { getTMDBTvMostRated } from "../tmdb";
import { type DailyGame, type DailyGamePoolEntry } from "./types";

// 25 pages of 20: the 500 most-rated shows. Any catalogued show can be
// guessed, but the answer should be one most players have watched. TV
// audiences split further than film audiences, so the list is shorter.
const ANSWER_PAGES = 25;

const shows = (pool: readonly DailyGamePoolEntry[]): PoolWork<TvDataSummary>[] =>
  pool.flatMap(({ externalId, title, data }) =>
    data.kind === "tv" && data.level === "show" ? [{ id: externalId, title, data }] : [],
  );

const catalogPage: DailyGame["catalogPage"] = async (page) =>
  (await getTMDBTvMostRated(page)).results.map((show) => ({
    externalId: String(show.id),
    title: show.name,
  }));

export const tvDailyGame: DailyGame = {
  // 100 pages of 20: the ~2000 most-rated shows, deep enough that most series
  // a player thinks to guess are in the pool.
  catalogPages: 100,
  catalogPage,
  rank: (answerId, pool) => rankPool(answerId, shows(pool), tvDailyGameRules),
  answerCandidates: async (pool) => {
    const top = await topWorkIds(catalogPage, ANSWER_PAGES);
    return shows(pool)
      .filter((show) => top.has(show.id) && tvDailyGameRules.canBeAnswer(show.data))
      .map((show) => show.id);
  },
};
