import { CockroachDialect } from "@cubos/kysely-cockroach";
import { existsSync, readFileSync, readdirSync } from "fs";
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

  try {
    // In Lambda/Netlify Functions, check for database-config.json next to this file
    const configPath = path.resolve(__dirname, "./database-config.json");
    console.log("Trying config path:", configPath);
    console.log("File exists?:", existsSync(configPath));

    // List what files ARE in __dirname
    try {
      const filesInDir = readdirSync(__dirname);
      console.log("Files in __dirname:", filesInDir);
    } catch (e) {
      console.log("Could not read __dirname:", e);
    }

    // Try to list parent directory too
    try {
      const parentDir = path.resolve(__dirname, "..");
      const filesInParent = readdirSync(parentDir);
      console.log("Files in parent directory:", filesInParent);
    } catch (e) {
      console.log("Could not read parent directory:", e);
    }

    // Try to list the expected utils directory
    try {
      const utilsDir = path.resolve(__dirname, "../utils");
      if (existsSync(utilsDir)) {
        const filesInUtils = readdirSync(utilsDir);
        console.log("Files in utils directory:", filesInUtils);
      } else {
        console.log("Utils directory does not exist at:", utilsDir);
      }
    } catch (e) {
      console.log("Could not read utils directory:", e);
    }

    // Try process.cwd() relative path
    try {
      const cwdConfigPath = path.resolve(
        process.cwd(),
        "netlify/functions/utils/database-config.json",
      );
      console.log("Trying process.cwd() path:", cwdConfigPath);
      console.log(
        "File exists at process.cwd() path?:",
        existsSync(cwdConfigPath),
      );
    } catch (e) {
      console.log("Could not check process.cwd() path:", e);
    }

    if (existsSync(configPath)) {
      const configText = readFileSync(configPath, "utf8");
      const config = configFileSchema.parse(JSON.parse(configText));
      console.log("✓ Config file found and parsed successfully");
      console.log("=== END DATABASE CONFIG DEBUG ===");
      return config.DATABASE_URL;
    } else {
      console.log(
        "Config file not found, falling back to process.env.DATABASE_URL",
      );
    }
  } catch (err) {
    console.log("Error reading config:", err);
  }

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
