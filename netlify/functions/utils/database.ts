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
  console.log("=== DATABASE CONFIG DEBUG ===");
  console.log("__dirname:", __dirname);
  console.log("process.cwd():", process.cwd());

  const pathsToTry = [
    path.resolve(__dirname, "./database-config.json"),
    path.resolve(__dirname, "./utils/database-config.json"),
    path.resolve(__dirname, "../utils/database-config.json"),
    path.resolve(process.cwd(), "netlify/functions/utils/database-config.json"),
  ];

  for (const configPath of pathsToTry) {
    console.log("Trying config path:", configPath);
    if (existsSync(configPath)) {
      try {
        console.log("✓ File exists at:", configPath);
        const configText = readFileSync(configPath, "utf8");
        const config = configFileSchema.parse(JSON.parse(configText));
        console.log("✓ Config file parsed successfully");
        console.log("=== END DATABASE CONFIG DEBUG ===");
        return config.DATABASE_URL;
      } catch (err) {
        console.log("Error reading config from", configPath, ":", err);
      }
    }
  }

  console.log(
    "Config file not found at any path, falling back to process.env.DATABASE_URL",
  );
  console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL);
  console.log("=== END DATABASE CONFIG DEBUG ===");
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
