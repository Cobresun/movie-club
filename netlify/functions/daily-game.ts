import { Handler, HandlerContext, HandlerEvent } from "@netlify/functions";

import { hasElements, isDefined } from "../../lib/checks/checks.js";
import {
  canBeAnswer,
  isSomebodysToday,
  pickAnswer,
  PoolMovie,
  puzzleDateSchema,
  rankPool,
} from "../../lib/dailyGame.js";
import { DailyGamePuzzle } from "../../lib/types/dailyGame";
import { WorkType } from "../../lib/types/generated/db.js";
import DailyGameRepository from "./repositories/DailyGameRepository";
import { getProvider } from "./utils/providers";
import { requireParam } from "./utils/requireParam";
import { badRequest, notFound, ok } from "./utils/responses";
import { isRouterResponse, Router } from "./utils/router";

const router = new Router("/api/daily-game");

/** Fewer movies than this and the ranks give the answer away. */
const MIN_POOL_SIZE = 10;

async function loadPool(): Promise<PoolMovie[]> {
  const movies = await DailyGameRepository.getMoviePool();
  const details = await getProvider(WorkType.movie).getExternalDataSummary(
    movies.map((movie) => movie.externalId),
  );
  return movies.flatMap((movie) => {
    const data = details.get(movie.externalId);
    return data?.kind === "movie" ? [{ id: movie.externalId, title: movie.title, data }] : [];
  });
}

// Public: the game is for anyone who lands on /play, signed in or not. The
// pool is titles and credits only — nothing says which club added a movie.
router.get("/:date", async ({ params }, res) => {
  const dateParam = requireParam(params, "date", res);
  if (isRouterResponse(dateParam)) return dateParam;
  const parsed = puzzleDateSchema.safeParse(dateParam);
  if (!parsed.success) return res(badRequest("Expected a date like 2026-10-22"));
  const date = parsed.data;
  if (!isSomebodysToday(date, new Date())) {
    return res(badRequest("Only today's puzzle can be played"));
  }

  const pool = await loadPool();
  if (pool.length < MIN_POOL_SIZE) {
    return res(notFound("Not enough movies have been added to play yet"));
  }

  let answerId = await DailyGameRepository.getAnswer(date);
  if (!isDefined(answerId)) {
    const pick = pickAnswer(
      pool.filter(canBeAnswer).map((movie) => movie.id),
      await DailyGameRepository.getPastAnswers(),
    );
    if (!isDefined(pick)) {
      return res(notFound("Not enough movies have been added to play yet"));
    }
    answerId = await DailyGameRepository.claimAnswer(date, pick);
  }

  // Empty only when the day's answer has since been removed from every club.
  const movies = rankPool(answerId, pool);
  if (!hasElements(movies)) return res(notFound("Today's movie is no longer available"));

  return res(
    ok<DailyGamePuzzle>({
      date,
      puzzle: await DailyGameRepository.getPuzzleNumber(date),
      movies,
    }),
  );
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  return router.route({ event, context, params: {} });
};

export { handler };
