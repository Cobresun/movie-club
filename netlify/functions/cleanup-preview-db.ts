import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { z } from "zod";

import DatabaseCleanupRepository from "./repositories/DatabaseCleanupRepository.js";
import { badRequest, internalServerError, ok } from "./utils/responses.js";
import { Router } from "./utils/router.js";

// Zod schema for validating Netlify webhook payload
const NetlifyWebhookPayloadSchema = z.object({
  id: z.string(),
  site_id: z.string(),
  build_id: z.string(),
  state: z.string(),
  name: z.string(),
  url: z.string(),
  ssl_url: z.string(),
  admin_url: z.string(),
  deploy_url: z.string(),
  deploy_ssl_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string(),
  error_message: z.string().optional(),
  required: z.array(z.string()).optional(),
  required_functions: z.array(z.string()).optional(),
  commit_url: z.string().optional(),
  review_id: z.number().optional(),
  context: z.string(),
  branch: z.string(),
  commit_ref: z.string().optional(),
  review_url: z.string().optional(),
  published_at: z.string().optional(),
});

const router = new Router("/api/cleanup-preview-db");

/**
 * Netlify webhook handler for deploy events
 */
router.post("/", async ({ event }, res) => {
  try {
    const eventBody = event.body;
    if (typeof eventBody !== "string" || eventBody.trim().length === 0) {
      return res(badRequest(JSON.stringify({ error: "No payload received" })));
    }

    // Parse and validate the webhook payload
    const parseResult = NetlifyWebhookPayloadSchema.safeParse(
      JSON.parse(eventBody),
    );

    if (!parseResult.success) {
      console.error("Invalid webhook payload:", parseResult.error);
      return res(
        badRequest(JSON.stringify({ error: "Invalid webhook payload" })),
      );
    }

    const payload = parseResult.data;

    console.log("Received webhook:", {
      context: payload.context,
      state: payload.state,
      review_id: payload.review_id,
      branch: payload.branch,
    });

    // Only process deploy-preview context
    if (payload.context !== "deploy-preview") {
      console.log("Ignoring non-preview deployment");
      return res(
        ok(JSON.stringify({ message: "Not a deploy preview, skipping" })),
      );
    }

    // Only cleanup when deploy is locked (PR closed/merged) or failed
    const shouldCleanup =
      payload.state === "locked" || payload.state === "error";

    if (!shouldCleanup) {
      console.log(`Ignoring state: ${payload.state}`);
      return res(
        ok(
          JSON.stringify({
            message: `State ${payload.state} does not trigger cleanup`,
          }),
        ),
      );
    }

    const reviewId = payload.review_id;
    if (typeof reviewId !== "number" || reviewId === 0) {
      console.log("No review_id in payload, cannot determine database name");
      return res(ok(JSON.stringify({ message: "No review_id, skipping" })));
    }

    const dbName = `pr_${reviewId}`;

    console.log(`Cleaning up preview database: ${dbName}`);

    // Use DatabaseCleanupRepository to drop the database
    await DatabaseCleanupRepository.dropDatabase(dbName);

    return res(
      ok(
        JSON.stringify({
          message: `Successfully cleaned up database: ${dbName}`,
          database: dbName,
          review_id: reviewId,
        }),
      ),
    );
  } catch (error) {
    console.error("Error in webhook handler:", error);

    return res(
      internalServerError(
        JSON.stringify({
          error: "Internal server error",
          message: (error as Error).message,
        }),
      ),
    );
  }
});

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  return router.route({ event, context, params: {} });
};
