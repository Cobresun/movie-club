import { isDefined } from "../../../../lib/checks/checks.js";
import { type PoolWork, rankPool } from "../../../../lib/dailyGame.js";
import { tvDailyGameRules } from "../../../../lib/tv/dailyGame.js";
import { WorkType } from "../../../../lib/types/generated/db";
import { type TvDataSummary } from "../../../../lib/types/tv";
import { topWorkIds } from "../dailyGame";
import { db } from "../database";
import { getTMDBTvMostRated } from "../tmdb";
import { type DailyGame, type MediaProvider } from "./types";

// 25 pages of 20: the 500 most-rated shows. Any catalogued show can be
// guessed, but the answer should be one most players have watched. TV
// audiences split further than film audiences, so the list is shorter.
const ANSWER_PAGES = 25;

/** The catalog's shows whose details are cached. */
async function loadShows(
  getSummaries: MediaProvider["getExternalDataSummary"],
): Promise<PoolWork<TvDataSummary>[]> {
  const works = await db
    .selectFrom("daily_game_catalog")
    .select(["external_id", "title"])
    .where("work_type", "=", WorkType.TV)
    .execute();
  const details = await getSummaries(works.map((work) => work.external_id));
  return works.flatMap(({ external_id, title }) => {
    const data = details.get(external_id);
    return isDefined(data) && data.kind === "tv" && data.level === "show"
      ? [{ id: external_id, title, data }]
      : [];
  });
}

const catalogPage: DailyGame["catalogPage"] = async (page) =>
  (await getTMDBTvMostRated(page)).results.map((show) => ({
    externalId: String(show.id),
    title: show.name,
  }));

export const makeTvDailyGame = (
  getSummaries: MediaProvider["getExternalDataSummary"],
): DailyGame => ({
  // 100 pages of 20: the ~2000 most-rated shows, deep enough that most series
  // a player thinks to guess are in the pool.
  catalogPages: 100,
  catalogPage,
  loadPool: async () => {
    const shows = await loadShows(getSummaries);
    return {
      size: shows.length,
      rank: (answerId) => rankPool(answerId, shows, tvDailyGameRules),
      answerCandidates: async () => {
        const top = await topWorkIds(catalogPage, ANSWER_PAGES);
        return shows
          .filter((show) => top.has(show.id) && tvDailyGameRules.canBeAnswer(show.data))
          .map((show) => show.id);
      },
    };
  },
});
