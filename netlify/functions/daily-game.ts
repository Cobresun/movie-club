import { type Handler, type HandlerContext, type HandlerEvent } from "@netlify/functions";
import { z } from "zod";

import { hasElements, isDefined } from "../../lib/checks/checks.js";
import { isSomebodysToday, pickAnswer, puzzleDateSchema } from "../../lib/dailyGame.js";
import { type DailyGamePuzzle } from "../../lib/types/dailyGame";
import { ClubType } from "../../lib/types/generated/db.js";
import DailyGameRepository from "./repositories/DailyGameRepository";
import { providerForClub } from "./utils/providers";
import { type DailyGamePoolEntry, type MediaProvider } from "./utils/providers/types";
import { badRequest, notFound, ok } from "./utils/responses";
import { Router } from "./utils/router";

const router = new Router("/api/daily-game");

/** Fewer works than this and the ranks give the answer away. */
const MIN_POOL_SIZE = 10;

/**
 * Ranking every work is the expensive part, and a day's puzzle reads the same
 * for everyone, so the CDN answers repeat requests. Ranks can still shift a
 * little while the pool grows during the day; ten minutes is fresh enough.
 */
const CDN_CACHE_CONTROL = "public, durable, s-maxage=600, stale-while-revalidate=600";

const paramsSchema = z.object({
  clubType: z.nativeEnum(ClubType),
  date: puzzleDateSchema,
});

async function loadPool(provider: MediaProvider): Promise<DailyGamePoolEntry[]> {
  const works = await DailyGameRepository.getPool(provider.type);
  const details = await provider.getExternalDataSummary(works.map((work) => work.externalId));
  return works.flatMap((work) => {
    const data = details.get(work.externalId);
    return isDefined(data) ? [{ ...work, data }] : [];
  });
}

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

  const pool = await loadPool(provider);
  const notEnough = notFound("Not enough works have been added to play yet");
  if (pool.length < MIN_POOL_SIZE) return res(notEnough);

  let answerId = await DailyGameRepository.getAnswer(provider.type, date);
  if (!isDefined(answerId)) {
    const pick = pickAnswer(
      game.answerCandidates(pool),
      await DailyGameRepository.getPastAnswers(provider.type),
    );
    if (!isDefined(pick)) return res(notEnough);
    answerId = await DailyGameRepository.claimAnswer(provider.type, date, pick);
  }

  // Empty only when the day's answer has since left the pool.
  const works = game.rank(answerId, pool);
  if (!hasElements(works)) return res(notFound("Today's answer is no longer available"));

  const response = ok<DailyGamePuzzle>({
    clubType,
    date,
    puzzle: await DailyGameRepository.getPuzzleNumber(provider.type, date),
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
