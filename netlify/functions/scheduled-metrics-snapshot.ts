import type { Config } from "@netlify/functions";
import { z } from "zod";

import MetricsRepository from "./repositories/MetricsRepository.js";

const ScheduledFunctionPayloadSchema = z.object({
  next_run: z.string(),
});

/**
 * Records a daily snapshot of site-wide metrics into `metric_snapshot`.
 *
 * This exists because some metrics are not reconstructible after the fact:
 * Better Auth deletes expired `session` rows, so historical monthly-active-user
 * counts vanish from the live tables. Anything not captured on the day is gone.
 *
 * Writes are keyed on the UTC date and upsert, so a retry or a manual trigger
 * refreshes the day rather than duplicating it.
 */
export default async (req: Request) => {
  try {
    const body: unknown = await req.json();
    const { next_run } = ScheduledFunctionPayloadSchema.parse(body);

    console.log("📊 Capturing daily metrics snapshot...");
    console.log(`Next scheduled run: ${next_run}`);

    const { capturedOn, metrics } = await MetricsRepository.captureSnapshot();

    console.log(`\n✅ Snapshot stored for ${capturedOn}`);
    console.log(
      `Users: ${metrics.totals.users}, clubs: ${metrics.totals.clubs}, ` +
        `reviews: ${metrics.totals.reviews}`,
    );
    console.log(
      `Engaged users (30d): ${metrics.engagedUsers.last30Days}, ` +
        `active clubs (30d): ${metrics.activeClubs.last30Days}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        capturedOn,
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
    console.error("❌ Metrics snapshot failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
