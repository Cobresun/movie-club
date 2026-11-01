import { type Config } from "@netlify/functions";
import { z } from "zod";

import { isDefined } from "../../lib/checks/checks.js";
import DailyGameRepository from "./repositories/DailyGameRepository.js";
import { allProviders } from "./utils/providers";
import { type CatalogCandidate, type DailyGame, type MediaProvider } from "./utils/providers/types";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

/**
 * New works cached per run and game. Each one is a source round trip plus its
 * inserts, so this keeps a run well inside a scheduled function's time limit;
 * running hourly fills an empty catalog within a day.
 */
const BATCH_SIZE = 50;

/** Catalog pages, and then works, fetched from the source at once. */
const CONCURRENCY = 5;

/**
 * A catalog that grew within this long is still filling, and is topped up
 * every hour. Once it stops growing, the source's best-known works barely
 * change from one day to the next, so it is swept once a day at
 * {@link DAILY_SWEEP_HOUR} UTC to pick up new releases.
 */
const FILLING_WINDOW_MS = 2 * 60 * 60 * 1000;
const DAILY_SWEEP_HOUR = 4;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface TopUpResult {
  type: string;
  skipped: boolean;
  added: number;
  errors: { externalId: string; error: string }[];
}

function isDue(lastAddition: Date | undefined, now: Date): boolean {
  if (!isDefined(lastAddition)) return true;
  return (
    now.getTime() - lastAddition.getTime() < FILLING_WINDOW_MS ||
    now.getUTCHours() === DAILY_SWEEP_HOUR
  );
}

/**
 * The source's best-known works not yet in the catalog, best known first, up
 * to {@link BATCH_SIZE}. Reads pages a few at a time and stops once it has a
 * batch; a page the source fails on is skipped rather than ending the run.
 */
async function findMissing(
  provider: MediaProvider,
  game: DailyGame,
  errors: TopUpResult["errors"],
): Promise<CatalogCandidate[]> {
  const missing = new Map<string, CatalogCandidate>();
  for (let first = 1; first <= game.catalogPages && missing.size < BATCH_SIZE;) {
    const pages = Array.from(
      { length: Math.min(CONCURRENCY, game.catalogPages - first + 1) },
      (_, index) => first + index,
    );
    first += pages.length;
    const results = await Promise.allSettled(pages.map((page) => game.catalogPage(page)));
    const candidates: CatalogCandidate[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") candidates.push(...result.value);
      else errors.push({ externalId: `page ${pages[index]}`, error: errorMessage(result.reason) });
    });
    const catalogued = await DailyGameRepository.getCatalogued(
      provider.type,
      candidates.map((candidate) => candidate.externalId),
    );
    for (const candidate of candidates) {
      if (!catalogued.has(candidate.externalId)) missing.set(candidate.externalId, candidate);
    }
  }
  return [...missing.values()].slice(0, BATCH_SIZE);
}

async function topUp(provider: MediaProvider, game: DailyGame, now: Date): Promise<TopUpResult> {
  const result: TopUpResult = { type: provider.type, skipped: false, added: 0, errors: [] };
  if (!isDue(await DailyGameRepository.getLastCatalogAddition(provider.type), now)) {
    return { ...result, skipped: true };
  }
  const missing = await findMissing(provider, game, result.errors);
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + CONCURRENCY).map(async (work) => {
        try {
          await provider.fetchAndCacheDetails(work.externalId);
          await DailyGameRepository.addToCatalog(provider.type, work);
          result.added++;
        } catch (error) {
          result.errors.push({ externalId: work.externalId, error: errorMessage(error) });
        }
      }),
    );
  }
  return result;
}

/**
 * Tops up each daily game's catalog with its source's best-known works, so a
 * game has a broad pool without anyone keeping a list by hand. Works already
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
        isDefined(provider.dailyGame) ? [topUp(provider, provider.dailyGame, now)] : [],
      ),
    );

    for (const result of results) {
      console.log(
        result.skipped
          ? `${result.type}: catalog is full; next sweep at ${DAILY_SWEEP_HOUR}:00 UTC`
          : `${result.type}: added ${result.added}`,
      );
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
