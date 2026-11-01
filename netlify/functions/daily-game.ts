import { type Handler, type HandlerContext, type HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import { hasElements, isDefined } from "../../lib/checks/checks.js";
import { isSomebodysToday, puzzleDateSchema, puzzleNumber } from "../../lib/dailyGame.js";
import { type DailyGamePuzzle } from "../../lib/types/dailyGame";
import { ClubType } from "../../lib/types/generated/db.js";
import DailyGameRepository from "./repositories/DailyGameRepository";
import {
  addMissingWorks,
  answerFor,
  type CatalogError,
  loadPool,
  MIN_POOL_SIZE,
} from "./utils/dailyGame";
import { providerForClub } from "./utils/providers";
import {
  type DailyGame,
  type DailyGamePoolEntry,
  type MediaProvider,
} from "./utils/providers/types";
import { badRequest, notFound, ok } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/daily-game");

/**
 * Ranking every work is the expensive part, and a day's puzzle reads the same
 * for everyone, so the CDN answers repeat requests. Ranks can still shift a
 * little while the pool grows during the day; ten minutes is fresh enough.
 */
const CDN_CACHE_CONTROL = "public, durable, s-maxage=600, stale-while-revalidate=600";

/**
 * Works cached on the spot when the catalog is too small to play. Only a
 * published production deploy runs the scheduled catalog job, so a deploy
 * preview, `netlify dev`, and production before the job's first run would
 * otherwise never have a game. Kept to about one source page, so a visitor
 * cannot make a request fetch more than that.
 */
const STARTER_CATALOG_SIZE = 20;

async function loadPlayablePool(
  provider: MediaProvider,
  game: DailyGame,
): Promise<DailyGamePoolEntry[]> {
  const pool = await loadPool(provider);
  if (pool.length >= MIN_POOL_SIZE) return pool;
  const errors: CatalogError[] = [];
  await addMissingWorks(provider, game, STARTER_CATALOG_SIZE, errors);
  errors.forEach((e) => console.log(`Starter catalog: ${e.externalId}: ${e.error}`));
  return loadPool(provider);
}

const paramsSchema = z.object({
  clubType: z.nativeEnum(ClubType),
  date: puzzleDateSchema,
});

// Public: the game is for anyone who lands on /play, signed in or not. The
// pool is the catalog of well-known works, so nothing in it comes from a club.
router.get("/:clubType/:date", async ({ params }, res) => {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return res(badRequest("Expected a club type and a date like 2026-10-22"));
  const { clubType, date } = parsed.data;
  if (!isSomebodysToday(date, new Date())) {
    return res(badRequest("Only today's puzzle can be played"));
  }

  const provider = providerForClub(clubType);
  const game = provider.dailyGame;
  if (!isDefined(game)) return res(notFound("This club type has no daily game"));

  // A day before the first puzzle would become puzzle #1 and renumber every
  // day after it, so the game's history starts where it started.
  const firstDate = await DailyGameRepository.getFirstPuzzleDate(provider.type);
  if (isDefined(firstDate) && date < firstDate) {
    return res(notFound("The game hadn't started yet on that day"));
  }

  const pool = await loadPlayablePool(provider, game);
  const notEnough = notFound("Not enough works have been added to play yet");
  if (pool.length < MIN_POOL_SIZE) return res(notEnough);

  const answerId = await answerFor(provider, game, date, pool);
  if (!isDefined(answerId)) return res(notEnough);

  // Empty only when the day's answer has since left the pool.
  const works = game.rank(answerId, pool);
  if (!hasElements(works)) return res(notFound("Today's answer is no longer available"));

  const response = ok<DailyGamePuzzle>({
    clubType,
    date,
    puzzle: puzzleNumber(firstDate ?? date, date),
    works,
  });
  return res({
    ...response,
    headers: { ...response.headers, "Netlify-CDN-Cache-Control": CDN_CACHE_CONTROL },
  });
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) =>
  router.route({ event, context, params: {} });

export { handler };
