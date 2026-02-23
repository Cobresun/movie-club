import type { Config } from "@netlify/functions";
import { z } from "zod";

import MovieRefreshRepository from "./repositories/MovieRefreshRepository.js";
import { getTMDBMovieData } from "./utils/tmdb.js";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

const BATCH_SIZE = 50;

/**
 * Scheduled function to refresh stale movie data from TMDB
 * Runs daily at midnight UTC
 * Fetches 50 oldest movies per run and updates them with fresh TMDB data
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("🎬 Starting scheduled movie data refresh...");
    console.log(`Next scheduled run: ${next_run}`);

    // Get the oldest 50 movies that need refreshing
    const staleMovies = await MovieRefreshRepository.getStaleMovies(BATCH_SIZE);

    if (staleMovies.length === 0) {
      console.log("✅ No movies to refresh");
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          updated: 0,
          skipped: 0,
          errors: [],
          next_run,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log(`Found ${staleMovies.length} movies to refresh`);

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ externalId: string; error: string }>,
    };

    // Process each movie
    for (const movie of staleMovies) {
      results.processed++;

      try {
        console.log(
          `[${results.processed}/${staleMovies.length}] Fetching TMDB data for movie ID ${movie.external_id}...`,
        );

        // Fetch fresh data from TMDB
        const response = await getTMDBMovieData(parseInt(movie.external_id));
        const tmdbData = response.data;

        console.log(`  ✓ Got data for "${tmdbData.title}"`);

        // Update database with fresh data
        const updateResult = await MovieRefreshRepository.refreshMovieDetails(
          movie.external_id,
          tmdbData,
        );

        if (updateResult.success) {
          results.updated++;
          console.log(`  ✓ Updated movie details successfully`);
        } else {
          results.skipped++;
          results.errors.push({
            externalId: movie.external_id,
            error: updateResult.error ?? "Unknown database error",
          });
          console.log(`  ✗ Failed to update: ${updateResult.error}`);
        }
      } catch (error) {
        results.skipped++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.errors.push({
          externalId: movie.external_id,
          error: errorMessage,
        });
        console.log(`  ✗ Failed to fetch from TMDB: ${errorMessage}`);
      }
    }

    console.log("\n✅ Refresh completed");
    console.log(`Processed: ${results.processed}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped (errors): ${results.skipped}`);

    if (results.errors.length > 0) {
      console.log("\nErrors encountered:");
      results.errors.forEach((e) => {
        console.log(`  - Movie ${e.externalId}: ${e.error}`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
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
    console.error("❌ Movie refresh failed:", error);

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
  schedule: "@daily",
};
