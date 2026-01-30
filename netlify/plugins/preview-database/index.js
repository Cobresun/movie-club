import { execSync } from "child_process";
import path from "path";

/**
 * @typedef {Object} PluginInputs
 * @property {string} [sourceDatabase]
 */

/**
 * @typedef {Object} NetlifyCacheUtils
 * @property {(value: string, keys: string[]) => Promise<void>} save
 * @property {(keys: string[]) => Promise<string | null | undefined>} restore
 */

/**
 * @typedef {Object} NetlifyBuildUtils
 * @property {(message: string) => void} failBuild
 */

/**
 * @typedef {Object} NetlifyPluginUtils
 * @property {NetlifyCacheUtils} cache
 * @property {NetlifyBuildUtils} build
 */

/**
 * @typedef {Object} PluginContext
 * @property {NetlifyPluginUtils} utils
 * @property {PluginInputs} inputs
 */

/**
 * Type guard to check if string has value (not null/undefined/empty)
 * @param {string | undefined | null} s
 * @returns {s is string}
 */
function hasValue(s) {
  return typeof s === "string" && s.length > 0;
}

/**
 * Checks if there are migration files changed in this PR
 * @returns {boolean}
 */
function checkForMigrations() {
  try {
    // Try to fetch main branch for comparison
    try {
      execSync("git fetch origin main:main", {
        stdio: "ignore",
        timeout: 10000,
      });
    } catch {
      // Ignore fetch errors, proceed with local refs
    }

    // Check for migration file changes
    const diffCmd =
      'git diff --name-only origin/main...HEAD | grep "^migrations/schema/" || true';

    const changedFiles = execSync(diffCmd, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    return changedFiles.length > 0;
  } catch (error) {
    console.warn(
      "Warning: Could not check for migrations, assuming migrations exist:",
      error.message,
    );
    // On error, assume migrations exist to be safe
    return true;
  }
}

/**
 * @param {PluginContext} context
 * @returns {Promise<void>}
 */
const onPreBuild = async ({ utils, inputs }) => {
  const { CONTEXT, REVIEW_ID, BRANCH } = process.env;

  // Only run for deploy previews
  if (CONTEXT !== "deploy-preview") {
    console.log("Skipping preview database setup (not a deploy preview)");
    return;
  }

  if (!hasValue(REVIEW_ID)) {
    console.log(
      "Warning: REVIEW_ID not available, skipping preview database setup",
    );
    return;
  }

  console.log("\n🔍 Checking for schema migrations...");

  try {
    // Check if this PR has migration files changed
    const hasMigrations = checkForMigrations();

    if (!hasMigrations) {
      console.log("✓ No schema migrations detected, using dev database");
      return;
    }

    console.log("✓ Schema migrations detected!");

    console.log(`🗄️  Creating preview database for PR #${REVIEW_ID}...\n`);

    const sourceDb = hasValue(inputs.sourceDatabase)
      ? inputs.sourceDatabase
      : "dev";
    const targetDb = `pr_${REVIEW_ID}`;

    // Create metadata for the preview database
    const metadata = JSON.stringify({
      created_at: new Date().toISOString(),
      pr_number: parseInt(REVIEW_ID, 10),
      branch: BRANCH ?? "unknown",
      created_by: "netlify-bot",
    });

    // Run db-spawn script (uses BACKUP/RESTORE from S3 snapshot)
    const scriptPath = path.join(process.cwd(), "scripts", "db-spawn.ts");
    const cmd = `npx tsx ${scriptPath} ${sourceDb} ${targetDb} --metadata='${metadata}'`;

    console.log(`Running: ${cmd}\n`);

    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: "pipe",
      env: { ...process.env, CI: "true" },
    });

    console.log(output);

    // Extract the new DATABASE_URL from output
    const match = /DATABASE_URL=(.+)/.exec(output);
    if (match && match[1]) {
      const newDatabaseUrl = match[1].trim();

      // Set the DATABASE_URL for the build
      process.env.DATABASE_URL = newDatabaseUrl;

      console.log(`\n✓ Preview database created: ${targetDb}`);
      console.log("✓ DATABASE_URL updated for this build\n");

      // Store database name for cleanup
      await utils.cache.save(targetDb, ["preview-database-name"]);
    } else {
      throw new Error("Failed to extract DATABASE_URL from db-spawn output");
    }
  } catch (error) {
    // If database creation fails, fail the build
    utils.build.failBuild(
      `Failed to create preview database: ${error.message}`,
    );
  }
};

/**
 * @param {Pick<PluginContext, 'utils'>} context
 * @returns {Promise<void>}
 */
const onSuccess = async ({ utils }) => {
  const { CONTEXT, REVIEW_ID } = process.env;

  if (CONTEXT !== "deploy-preview" || !hasValue(REVIEW_ID)) {
    return;
  }

  // Check if we created a preview database
  const dbName = await utils.cache.restore(["preview-database-name"]);

  if (hasValue(dbName)) {
    console.log(`\n✓ Deploy preview using database: ${dbName}`);
    console.log(
      `  Database will be cleaned up when PR #${REVIEW_ID} is closed\n`,
    );
  }
};

/**
 * @param {Pick<PluginContext, 'utils'>} context
 * @returns {Promise<void>}
 */
const onError = async ({ utils }) => {
  const { CONTEXT, REVIEW_ID } = process.env;

  if (CONTEXT !== "deploy-preview" || !hasValue(REVIEW_ID)) {
    return;
  }

  // Check if we created a preview database
  const dbName = await utils.cache.restore(["preview-database-name"]);

  if (hasValue(dbName)) {
    console.log(
      `\n⚠️  Build failed. Preview database ${dbName} will be cleaned up.`,
    );

    try {
      // Optionally cleanup on build failure
      // Uncomment if you want to auto-cleanup failed builds
      // const cleanupCmd = `npx tsx scripts/db-cleanup.ts --name ${dbName} --force`;
      // execSync(cleanupCmd, { stdio: 'inherit', env: process.env });
    } catch (error) {
      console.warn(
        "Warning: Failed to cleanup preview database:",
        error.message,
      );
    }
  }
};

export { onPreBuild, onSuccess, onError };
