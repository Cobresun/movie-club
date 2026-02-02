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
    // In Lambda/Netlify Functions, check for database-config.json next to this file
    const configPath = path.resolve(__dirname, "./database-config.json");
    console.log("__dirname:", __dirname);
    console.log("process.cwd():", process.cwd());
    console.log("Trying config path:", configPath);
    console.log("File exists?:", existsSync(configPath));
    if (existsSync(configPath)) {
      const configText = readFileSync(configPath, "utf8");
      const config = configFileSchema.parse(JSON.parse(configText));
      return config.DATABASE_URL;
    }
  } catch {
    // Fallback for local dev if file doesn't exist or is malformed
  }
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
