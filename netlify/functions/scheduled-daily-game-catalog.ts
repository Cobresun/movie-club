import { type Config } from "@netlify/functions";
import { z } from "zod";

import { isDefined } from "../../lib/checks/checks.js";
import { upcomingPuzzleDates } from "../../lib/dailyGame.js";
import DailyGameRepository from "./repositories/DailyGameRepository.js";
import {
  addMissingWorks,
  answerFor,
  type CatalogError,
  errorMessage,
  loadPool,
  MIN_POOL_SIZE,
} from "./utils/dailyGame";
import { allProviders } from "./utils/providers";
import { type DailyGame, type MediaProvider } from "./utils/providers/types";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

/**
 * New works cached per run and game. Each one is a source round trip plus its
 * inserts, so this keeps a run well inside a scheduled function's time limit;
 * running hourly fills an empty catalog within a day.
 */
const BATCH_SIZE = 50;

/**
 * A catalog that grew within this long is still filling, and is topped up
 * every hour. Once it stops growing, the source's best-known works barely
 * change from one day to the next, so it is swept once a day at
 * {@link DAILY_SWEEP_HOUR} UTC to pick up new releases.
 */
const FILLING_WINDOW_MS = 2 * 60 * 60 * 1000;
const DAILY_SWEEP_HOUR = 4;

interface TopUpResult {
  type: string;
  skipped: boolean;
  added: number;
  errors: CatalogError[];
}

interface GameRunResult extends TopUpResult {
  recorded: string[];
}

function isDue(lastAddition: Date | undefined, now: Date): boolean {
  if (!isDefined(lastAddition)) return true;
  return (
    now.getTime() - lastAddition.getTime() < FILLING_WINDOW_MS ||
    now.getUTCHours() === DAILY_SWEEP_HOUR
  );
}

async function topUp(provider: MediaProvider, game: DailyGame, now: Date): Promise<TopUpResult> {
  const result: TopUpResult = { type: provider.type, skipped: false, added: 0, errors: [] };
  if (!isDue(await DailyGameRepository.getLastCatalogAddition(provider.type), now)) {
    return { ...result, skipped: true };
  }
  result.added = await addMissingWorks(provider, game, BATCH_SIZE, result.errors);
  return result;
}

/**
 * Draws and records the answer for each upcoming day that has none, so every
 * day is a puzzle whether or not anyone plays it. Returns the dates recorded.
 */
async function recordPuzzles(provider: MediaProvider, game: DailyGame, now: Date) {
  const dates: string[] = [];
  for (const date of upcomingPuzzleDates(now)) {
    if (!isDefined(await DailyGameRepository.getAnswer(provider.type, date))) dates.push(date);
  }
  if (dates.length === 0) return [];
  const pool = await loadPool(provider);
  if (pool.length < MIN_POOL_SIZE) return [];
  const recorded: string[] = [];
  // One at a time and oldest first, so each draw avoids the one before it.
  for (const date of dates) {
    if (isDefined(await answerFor(provider, game, date, pool))) recorded.push(date);
  }
  return recorded;
}

async function runGame(
  provider: MediaProvider,
  game: DailyGame,
  now: Date,
): Promise<GameRunResult> {
  const result = await topUp(provider, game, now);
  return { ...result, recorded: await recordPuzzles(provider, game, now) };
}

/**
 * Tops up each daily game's catalog with its source's best-known works, so a
 * game has a broad pool without anyone keeping a list by hand, then records
 * the coming days' answers. Works already
 * in the catalog are skipped, and ones that later fall out of the top pages
 * stay in it, so the pool only grows as new releases climb the rankings.
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("🎬 Starting daily game catalog top-up...");
    console.log(`Next scheduled run: ${next_run}`);

    const now = new Date();
    const results = await Promise.all(
      allProviders().flatMap((provider) =>
        isDefined(provider.dailyGame) ? [runGame(provider, provider.dailyGame, now)] : [],
      ),
    );

    for (const result of results) {
      console.log(
        result.skipped
          ? `${result.type}: catalog is full; next sweep at ${DAILY_SWEEP_HOUR}:00 UTC`
          : `${result.type}: added ${result.added}`,
      );
      if (result.recorded.length > 0) {
        console.log(`  recorded puzzles for ${result.recorded.join(", ")}`);
      }
      result.errors.forEach((e) => console.log(`  - ${e.externalId}: ${e.error}`));
    }

    return new Response(JSON.stringify({ success: true, results, next_run }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Catalog top-up failed:", error);

    return new Response(JSON.stringify({ success: false, error: errorMessage(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "@hourly",
};
