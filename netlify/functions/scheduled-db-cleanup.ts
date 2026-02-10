import type { Config } from "@netlify/functions";
import { z } from "zod";

import DatabaseCleanupRepository from "./repositories/DatabaseCleanupRepository.js";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

/**
 * Scheduled function to clean up stale preview databases
 * Runs daily at midnight UTC
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("🧹 Starting scheduled database cleanup...");
    console.log(`Next scheduled run: ${next_run}`);

    // Clean up databases older than 7 days
    const result = await DatabaseCleanupRepository.cleanupOldDatabases(7);

    console.log("\n✅ Cleanup completed successfully");
    console.log(`Databases cleaned: ${result.count}`);
    if (result.deleted.length > 0) {
      console.log(`Deleted: ${result.deleted.join(", ")}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: result.count,
        deleted: result.deleted,
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
    console.error("❌ Cleanup failed:", error);

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
