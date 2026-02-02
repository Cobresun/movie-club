import { CockroachDialect } from "@cubos/kysely-cockroach";
import { existsSync, readFileSync } from "fs";
import { Kysely } from "kysely";
import path from "path";
import { Pool } from "pg";
import z from "zod";

import { DB } from "../../../lib/types/generated/db";

const configFileSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
});

/**
 * Gets the DATABASE_URL from config file (deploy previews) or environment (local dev)
 * @returns {string | undefined} The database connection string
 */
export function getDbUrl(): string | undefined {
  try {
    // In deployed functions, check for database-config.json in utils directory
    const configPath = path.resolve(__dirname, "./utils/database-config.json");

    if (existsSync(configPath)) {
      const configText = readFileSync(configPath, "utf8");
      const config = configFileSchema.parse(JSON.parse(configText));
      return config.DATABASE_URL;
    }
  } catch (err) {
    console.warn("Error reading database config file:", err);
  }

  // Fallback to environment variable for local development
  return process.env.DATABASE_URL;
}

export const pool = new Pool({
  connectionString: getDbUrl(),
});
export const dialect = new CockroachDialect({
  pool,
});

export const db = new Kysely<DB>({
  dialect,
});
