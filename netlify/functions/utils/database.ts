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

export function getDbUrl(): string | undefined {
  try {
    const configPath = path.resolve(__dirname, "./utils/database-config.json");

    if (existsSync(configPath)) {
      const configText = readFileSync(configPath, "utf8");
      const config = configFileSchema.parse(JSON.parse(configText));
      return config.DATABASE_URL;
    }
  } catch {
    // Silent fallback to environment variable
  }

  return process.env.DATABASE_URL;
}

console.log("Using DATABASE_URL:", getDbUrl());
export const pool = new Pool({
  connectionString: getDbUrl(),
});
export const dialect = new CockroachDialect({
  pool,
});

export const db = new Kysely<DB>({
  dialect,
});
