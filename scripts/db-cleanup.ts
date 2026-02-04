#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as readline from "readline/promises";

import { hasValue } from "../lib/checks/checks.js";
import DatabaseCleanupRepository from "../netlify/functions/repositories/DatabaseCleanupRepository.js";

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
 * Cleans up databases based on options
 */
async function cleanupDatabases(options: CleanupOptions): Promise<void> {
  const databases = await DatabaseCleanupRepository.listDatabases();
  let toDelete: typeof databases = [];

  if (hasValue(options.databaseName)) {
    const db = databases.find((d) => d.name === options.databaseName);
    if (db === undefined) {
      throw new Error(`Database not found: ${options.databaseName}`);
    }
    toDelete = [db];
  } else if (hasValue(options.pattern)) {
    const regex = new RegExp(options.pattern);
    toDelete = databases.filter((db) => regex.test(db.name));
  } else if (typeof options.olderThanDays === "number") {
    toDelete = await DatabaseCleanupRepository.listDatabasesOlderThan(
      options.olderThanDays,
    );
  } else {
    throw new Error("Must specify --name, --pattern, or --older-than option");
  }

  toDelete = toDelete.filter((db) =>
    DatabaseCleanupRepository.canDeleteDatabase(db.name),
  );

  if (toDelete.length === 0) {
    console.log("No databases to clean up.");
    return;
  }

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

  if (options.force !== true) {
    const confirmed = await confirm(
      "\n⚠️  Are you sure you want to delete these databases? This cannot be undone!",
    );

    if (!confirmed) {
      console.log("Cleanup cancelled.");
      return;
    }
  }

  console.log("\nDeleting databases...\n");
  let deletedCount = 0;
  for (const db of toDelete) {
    try {
      await DatabaseCleanupRepository.dropDatabase(db.name);
      deletedCount++;
    } catch (error) {
      console.error(
        `Failed to drop database ${db.name}:`,
        (error as Error).message,
      );
    }
  }

  console.log(`\n✓ Successfully deleted ${deletedCount} database(s)`);
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

  if (args.length > 0 && !args[0].startsWith("--")) {
    const featureName = args[0];

    // Try to match dev_{username}_{feature} pattern
    // For simplicity, just use the provided name
    options.databaseName = featureName.startsWith("dev_")
      ? featureName
      : featureName;
  }

  if (args.includes("--restore-env")) {
    restoreEnvToDev();
    return;
  }

  try {
    await cleanupDatabases(options);

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

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { cleanupDatabases };
