import {
  type Handler,
  type HandlerContext,
  type HandlerEvent,
  type HandlerResponse,
} from "@netlify/functions";
import { z } from "zod";

import { hasElements, isDefined } from "../../lib/checks/checks.js";
import {
  isSomebodysToday,
  latestPuzzleDate,
  puzzleDateSchema,
  puzzleNumber,
} from "../../lib/dailyGame.js";
import { type DailyGameArchive, type DailyGamePuzzle } from "../../lib/types/dailyGame";
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

const cdnCached = (response: HandlerResponse): HandlerResponse => ({
  ...response,
  headers: { ...response.headers, "Netlify-CDN-Cache-Control": CDN_CACHE_CONTROL },
});

const clubTypeSchema = z.object({ clubType: z.nativeEnum(ClubType) });

const paramsSchema = clubTypeSchema.extend({ date: puzzleDateSchema });

// Public, like the puzzles it lists. Dates only: an answer is never sent
// before its puzzle is opened.
router.get("/:clubType/archive", async ({ params }, res) => {
  const parsed = clubTypeSchema.safeParse(params);
  if (!parsed.success) return res(badRequest("Expected a club type"));
  const { clubType } = parsed.data;

  const provider = providerForClub(clubType);
  if (!isDefined(provider.dailyGame)) return res(notFound("This club type has no daily game"));

  const dates = await DailyGameRepository.getPuzzleDates(
    provider.type,
    latestPuzzleDate(new Date()),
  );
  const [firstDate] = dates;
  const puzzles = dates
    .map((date) => ({ date, puzzle: puzzleNumber(firstDate ?? date, date) }))
    .reverse();
  return res(cdnCached(ok<DailyGameArchive>({ clubType, puzzles })));
});

// Public: the game is for anyone who lands on it, signed in or not. The
// pool is the catalog of well-known works, so nothing in it comes from a club.
router.get("/:clubType/:date", async ({ params }, res) => {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return res(badRequest("Expected a club type and a date like 2026-10-22"));
  const { clubType, date } = parsed.data;
  const now = new Date();
  if (date > latestPuzzleDate(now)) return res(badRequest("That puzzle isn't out yet"));

  const provider = providerForClub(clubType);
  const game = provider.dailyGame;
  if (!isDefined(game)) return res(notFound("This club type has no daily game"));

  // A day before the first puzzle would become puzzle #1 and renumber every
  // day after it, so the game's history starts where it started.
  const firstDate = await DailyGameRepository.getFirstPuzzleDate(provider.type);
  if (isDefined(firstDate) && date < firstDate) {
    return res(notFound("The game hadn't started yet on that day"));
  }

  // A day that is over everywhere plays from the archive with the answer it
  // had. One without an answer was never a puzzle, and drawing one now would
  // hand the archive a day nobody could have played.
  const live = isSomebodysToday(date, now);
  const archived = live ? undefined : await DailyGameRepository.getAnswer(provider.type, date);
  if (!live && !isDefined(archived)) return res(notFound("There was no puzzle that day"));

  const pool = await loadPlayablePool(provider, game);
  const notEnough = notFound("Not enough works have been added to play yet");
  if (pool.length < MIN_POOL_SIZE) return res(notEnough);

  const answerId = archived ?? (await answerFor(provider, game, date, pool));
  if (!isDefined(answerId)) return res(notEnough);

  // Empty only when the day's answer has since left the pool.
  const works = game.rank(answerId, pool);
  if (!hasElements(works)) return res(notFound("Today's answer is no longer available"));

  return res(
    cdnCached(
      ok<DailyGamePuzzle>({
        clubType,
        date,
        puzzle: puzzleNumber(firstDate ?? date, date),
        works,
      }),
    ),
  );
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) =>
  router.route({ event, context, params: {} });

export { handler };
