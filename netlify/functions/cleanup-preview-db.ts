import type { Handler, HandlerEvent } from "@netlify/functions";
import { Pool } from "pg";

import { hasValue } from "../../lib/checks/checks.js";

interface NetlifyWebhookPayload {
  id: string;
  site_id: string;
  build_id: string;
  state: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  error_message?: string;
  required?: string[];
  required_functions?: string[];
  commit_url?: string;
  review_id?: number;
  context: string;
  branch: string;
  commit_ref?: string;
  review_url?: string;
  published_at?: string;
}

const PROTECTED_DATABASES = ["dev", "prod", "defaultdb", "postgres", "system"];

/**
 * Drops a preview database
 */
async function dropPreviewDatabase(dbName: string): Promise<void> {
  if (PROTECTED_DATABASES.includes(dbName)) {
    throw new Error(`Cannot delete protected database: ${dbName}`);
  }

  if (!dbName.startsWith("pr_")) {
    throw new Error(
      `Database name must start with 'pr_' for safety: ${dbName}`,
    );
  }

  const databaseUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL_ROOT environment variable is not set");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log(`Dropping preview database: ${dbName}...`);

    // Terminate all connections to the database first
    await pool.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `,
      [dbName],
    );

    // Drop the database
    await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);

    console.log(`✓ Dropped preview database: ${dbName}`);
  } finally {
    await pool.end();
  }
}

/**
 * Netlify webhook handler for deploy events
 */
export const handler: Handler = async (event: HandlerEvent) => {
  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const eventBody = event.body;
    if (typeof eventBody !== "string" || eventBody.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No payload received" }),
      };
    }

    const payload: NetlifyWebhookPayload = JSON.parse(
      eventBody,
    ) as NetlifyWebhookPayload;

    console.log("Received webhook:", {
      context: payload.context,
      state: payload.state,
      review_id: payload.review_id,
      branch: payload.branch,
    });

    // Only process deploy-preview context
    if (payload.context !== "deploy-preview") {
      console.log("Ignoring non-preview deployment");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Not a deploy preview, skipping" }),
      };
    }

    // Only cleanup when deploy is locked (PR closed/merged) or failed
    const shouldCleanup =
      payload.state === "locked" || payload.state === "error";

    if (!shouldCleanup) {
      console.log(`Ignoring state: ${payload.state}`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `State ${payload.state} does not trigger cleanup`,
        }),
      };
    }

    const reviewId = payload.review_id;
    if (typeof reviewId !== "number" || reviewId === 0) {
      console.log("No review_id in payload, cannot determine database name");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No review_id, skipping" }),
      };
    }

    const dbName = `pr_${reviewId}`;

    console.log(`Cleaning up preview database: ${dbName}`);

    await dropPreviewDatabase(dbName);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully cleaned up database: ${dbName}`,
        database: dbName,
        review_id: payload.review_id,
      }),
    };
  } catch (error) {
    console.error("Error in webhook handler:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        message: (error as Error).message,
      }),
    };
  }
};
