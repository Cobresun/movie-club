import type { Config } from "@netlify/functions";
import { z } from "zod";

import { WorkType } from "../../lib/types/generated/db.js";
import DailyGameRepository from "./repositories/DailyGameRepository.js";
import { getProvider } from "./utils/providers";
import { getTMDBMostRated } from "./utils/tmdb";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

/** TMDB pages of most-rated movies the catalog covers, at 20 movies a page. */
const CATALOG_PAGES = 50;

/**
 * New movies cached per run. Each one is a TMDB round trip plus its inserts,
 * so this keeps a run well inside a scheduled function's time limit; running
 * hourly fills an empty catalog within a day.
 */
const BATCH_SIZE = 50;

/** Movies fetched from TMDB at once. */
const CONCURRENCY = 10;

/**
 * Tops up Closer's catalog with TMDB's most-rated movies, so the daily game
 * has a broad pool without anyone keeping a list by hand. Movies already in
 * the catalog are skipped, and ones that later fall out of the top pages stay
 * in it, so the pool only grows as new releases climb the rankings.
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("🎬 Starting daily game catalog top-up...");
    console.log(`Next scheduled run: ${next_run}`);

    const pages = await Promise.all(
      Array.from({ length: CATALOG_PAGES }, (_, index) => getTMDBMostRated(index + 1)),
    );
    const ranked = [...new Set(pages.flatMap((page) => page.results.map((m) => String(m.id))))];
    const catalogued = await DailyGameRepository.getCatalogued(ranked);
    const missing = ranked.filter((id) => !catalogued.has(id)).slice(0, BATCH_SIZE);

    const provider = getProvider(WorkType.movie);
    const errors: { externalId: string; error: string }[] = [];
    let added = 0;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      await Promise.all(
        missing.slice(i, i + CONCURRENCY).map(async (externalId) => {
          try {
            await provider.fetchAndCacheDetails(externalId);
            await DailyGameRepository.addToCatalog(externalId);
            added++;
          } catch (error) {
            errors.push({
              externalId,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }),
      );
    }

    console.log("\n✅ Catalog top-up completed");
    console.log(`Already catalogued: ${catalogued.size}`);
    console.log(`Added: ${added}`);
    errors.forEach((e) => console.log(`  - ${e.externalId}: ${e.error}`));

    return new Response(
      JSON.stringify({
        success: true,
        catalogued: catalogued.size,
        added,
        errors,
        next_run,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("❌ Catalog top-up failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};

export const config: Config = {
  schedule: "@hourly",
};
