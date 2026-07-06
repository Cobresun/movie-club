import type { Config } from "@netlify/functions";
import { z } from "zod";

import { allProviders } from "./utils/providers";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

// Refreshed works per provider per run (oldest cached details first).
const BATCH_SIZE = 50;

/**
 * Scheduled function to refresh stale cached work metadata from external
 * sources. Runs daily and sweeps every registered media provider (TMDB movies,
 * Google Books books, …), refreshing the oldest BATCH_SIZE works of each.
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("🔄 Starting scheduled work data refresh...");
    console.log(`Next scheduled run: ${next_run}`);

    const totals = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ type: string; externalId: string; error: string }>,
    };

    for (const provider of allProviders()) {
      console.log(`\n— Refreshing ${provider.type} works —`);
      const result = await provider.refreshStaleDetails(BATCH_SIZE);

      totals.processed += result.processed;
      totals.updated += result.updated;
      totals.skipped += result.errors.length;
      totals.errors.push(
        ...result.errors.map((e) => ({ type: provider.type, ...e })),
      );

      console.log(
        `  ${provider.type}: processed ${result.processed}, updated ${result.updated}, errors ${result.errors.length}`,
      );
    }

    console.log("\n✅ Refresh completed");
    console.log(`Processed: ${totals.processed}`);
    console.log(`Updated: ${totals.updated}`);
    console.log(`Skipped (errors): ${totals.skipped}`);

    if (totals.errors.length > 0) {
      console.log("\nErrors encountered:");
      totals.errors.forEach((e) => {
        console.log(`  - ${e.type} ${e.externalId}: ${e.error}`);
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...totals,
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
    console.error("❌ Work refresh failed:", error);

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
