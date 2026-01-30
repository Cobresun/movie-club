#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import * as readline from "readline/promises";

import { listDatabases } from "./db-list.js";
import { hasValue } from "../lib/checks/checks.js";

const PROTECTED_DATABASES = ["dev", "prod", "defaultdb", "postgres", "system"];

interface CleanupOptions {
  databaseName?: string;
  olderThanDays?: number;
  pattern?: string;
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Prompts user for confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`${question} (yes/no): `);
  rl.close();

  return answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
}

/**
 * Validates that a database can be safely deleted
 */
function canDeleteDatabase(dbName: string): boolean {
  if (PROTECTED_DATABASES.includes(dbName)) {
    return false;
  }

  // Additional safety: don't delete databases without prefix
  if (
    !dbName.startsWith("pr_") &&
    !dbName.startsWith("dev_") &&
    dbName !== "dev"
  ) {
    console.warn(
      `⚠️  Warning: Database ${dbName} doesn't match expected naming pattern`,
    );
    return false;
  }

  return true;
}

/**
 * Drops a database
 */
async function dropDatabase(
  pool: Pool,
  dbName: string,
  dryRun: boolean = false,
): Promise<void> {
  if (!canDeleteDatabase(dbName)) {
    throw new Error(
      `Cannot delete protected database: ${dbName}. Protected databases: ${PROTECTED_DATABASES.join(", ")}`,
    );
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would drop database: ${dbName}`);
    return;
  }

  console.log(`Dropping database: ${dbName}...`);

  // Note: CockroachDB doesn't support pg_terminate_backend()
  // We'll try to drop directly and handle any active connection errors
  try {
    // Drop the database
    await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✓ Dropped database: ${dbName}`);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage.includes("cannot drop the currently open database")) {
      throw new Error(
        `Cannot drop database ${dbName}: it's currently in use. Close all connections and try again.`,
      );
    }
    throw error;
  }
}

/**
 * Cleans up databases based on options
 */
async function cleanupDatabases(options: CleanupOptions): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const databases = await listDatabases();
    let toDelete: typeof databases = [];

    // Filter databases based on options
    if (hasValue(options.databaseName)) {
      // Clean up specific database
      const db = databases.find((d) => d.name === options.databaseName);
      if (db === undefined) {
        throw new Error(`Database not found: ${options.databaseName}`);
      }
      toDelete = [db];
    } else if (hasValue(options.pattern)) {
      // Clean up by pattern
      const regex = new RegExp(options.pattern);
      toDelete = databases.filter((db) => regex.test(db.name));
    } else if (typeof options.olderThanDays === "number") {
      // Clean up by age
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);

      toDelete = databases.filter((db) => {
        const createdAt = db.metadata?.created_at;
        if (!hasValue(createdAt)) return false;

        const createdDate = new Date(createdAt);
        return createdDate < cutoffDate;
      });
    } else {
      throw new Error("Must specify --name, --pattern, or --older-than option");
    }

    // Filter out protected databases
    toDelete = toDelete.filter((db) => canDeleteDatabase(db.name));

    if (toDelete.length === 0) {
      console.log("No databases to clean up.");
      return;
    }

    // Display what will be deleted
    console.log("\nDatabases to be deleted:");
    console.log("─".repeat(80));
    toDelete.forEach((db) => {
      const createdAt = db.metadata?.created_at;
      const age = hasValue(createdAt)
        ? ` (created ${new Date(createdAt).toLocaleDateString()})`
        : "";
      console.log(`  • ${db.name}${age}`);
    });
    console.log("─".repeat(80));
    console.log(`Total: ${toDelete.length} database(s)\n`);

    if (options.dryRun === true) {
      console.log("[DRY RUN] No databases were actually deleted.");
      return;
    }

    // Confirm deletion unless --force
    if (options.force !== true) {
      const confirmed = await confirm(
        "\n⚠️  Are you sure you want to delete these databases? This cannot be undone!",
      );

      if (!confirmed) {
        console.log("Cleanup cancelled.");
        return;
      }
    }

    // Delete databases
    console.log("\nDeleting databases...\n");
    for (const db of toDelete) {
      await dropDatabase(pool, db.name, options.dryRun);
    }

    console.log(`\n✓ Successfully deleted ${toDelete.length} database(s)`);
  } finally {
    await pool.end();
  }
}

/**
 * Restores local .env to use dev database
 */
function restoreEnvToDev(): void {
  const envPath = join(process.cwd(), ".env");

  try {
    const envContent = readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");

    const updatedLines = lines.map((line: string) => {
      if (line.startsWith("DATABASE_URL=")) {
        // Extract connection string and replace database name with 'dev'
        const match = line.match(/^DATABASE_URL=(.+)$/);
        if (match) {
          const url = match[1];
          const replaced = url.replace(/\/[^/?]+(\?|$)/, "/dev$1");
          return `DATABASE_URL=${replaced}`;
        }
      }
      return line;
    });

    writeFileSync(envPath, updatedLines.join("\n"));
    console.log("✓ Restored .env to use dev database");
  } catch {
    console.warn(
      "Warning: Could not update .env file. Please update DATABASE_URL manually.",
    );
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log("Usage: npm run db:cleanup [options]");
    console.log("\nOptions:");
    console.log("  <name>                 Delete specific database by name");
    console.log("  --pattern <regex>      Delete databases matching pattern");
    console.log("  --older-than <days>    Delete databases older than X days");
    console.log("  --force                Skip confirmation prompt");
    console.log(
      "  --dry-run              Show what would be deleted without deleting",
    );
    console.log("  --restore-env          Restore .env to use dev database");
    console.log("\nExamples:");
    console.log("  npm run db:cleanup my-feature");
    console.log("  npm run db:cleanup --pattern '^pr_'");
    console.log("  npm run db:cleanup --older-than 7");
    console.log("  npm run db:cleanup --older-than 7 --dry-run");
    process.exit(0);
  }

  const options: CleanupOptions = {
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
  };

  // Parse options
  const patternIndex = args.indexOf("--pattern");
  if (patternIndex !== -1 && args[patternIndex + 1]) {
    options.pattern = args[patternIndex + 1];
  }

  const olderThanIndex = args.indexOf("--older-than");
  if (olderThanIndex !== -1 && args[olderThanIndex + 1]) {
    options.olderThanDays = parseInt(args[olderThanIndex + 1], 10);
    if (isNaN(options.olderThanDays)) {
      console.error("Error: --older-than must be a number");
      process.exit(1);
    }
  }

  // If first arg doesn't start with --, treat it as database name
  if (args.length > 0 && !args[0].startsWith("--")) {
    const featureName = args[0];

    // Try to match dev_{username}_{feature} pattern
    // For simplicity, just use the provided name
    options.databaseName = featureName.startsWith("dev_")
      ? featureName
      : featureName; // User can provide full name or we use as-is
  }

  // Handle --restore-env flag
  if (args.includes("--restore-env")) {
    restoreEnvToDev();
    return;
  }

  try {
    await cleanupDatabases(options);

    // Offer to restore .env if deleting a personal dev database
    const dbName = options.databaseName;
    if (
      hasValue(dbName) &&
      dbName.startsWith("dev_") &&
      options.dryRun !== true &&
      process.env.CI !== "true"
    ) {
      console.log();
      const shouldRestore = await confirm(
        "Restore your .env to use the main dev database?",
      );

      if (shouldRestore) {
        restoreEnvToDev();
      }
    }
  } catch (error) {
    console.error("\n✗ Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { cleanupDatabases, dropDatabase };
