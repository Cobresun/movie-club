import { execSync } from "child_process";
import { createHash } from "crypto";
import { readdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

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
 * Calculates SHA256 hash of all migration files
 * @returns {string} Hash of all migration file contents
 */
function calculateMigrationHash() {
  const migrationsDir = path.join(process.cwd(), "migrations", "schema");

  if (!existsSync(migrationsDir)) {
    return "no-migrations";
  }

  try {
    // Read all migration files, sorted alphabetically for consistency
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".ts"))
      .sort();

    if (files.length === 0) {
      return "no-migrations";
    }

    // Concatenate all file contents
    const contents = files
      .map((file) => {
        const filePath = path.join(migrationsDir, file);
        return readFileSync(filePath, "utf-8");
      })
      .join("\n");

    // Calculate hash
    const hash = createHash("sha256").update(contents).digest("hex");
    return hash;
  } catch (error) {
    console.warn("Warning: Could not calculate migration hash:", error.message);
    // Return a timestamp-based hash to force rebuild on error
    return `error-${Date.now()}`;
  }
}

/**
 * Checks if a database exists
 * @param {string} dbName
 * @returns {Promise<boolean>}
 */
async function checkDatabaseExists(dbName) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Parse connection string and connect to defaultdb to check for database
  const url = new URL(databaseUrl);
  url.pathname = "/defaultdb";
  const adminConnString = url.toString();

  const pool = new Pool({ connectionString: adminConnString });

  try {
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    await pool.end();
  }
}

/**
 * Drops a database if it exists
 * @param {string} dbName
 * @returns {Promise<void>}
 */
async function dropDatabase(dbName) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const url = new URL(databaseUrl);
  url.pathname = "/defaultdb";
  const adminConnString = url.toString();

  const pool = new Pool({ connectionString: adminConnString });

  try {
    console.log(`🗑️  Dropping existing database ${dbName}...`);
    await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✓ Database dropped: ${dbName}`);
  } finally {
    await pool.end();
  }
}

/**
 * Writes DATABASE_URL to .env file so Netlify Functions can access it at runtime
 * @param {string} databaseUrl - The database connection string
 * @returns {void}
 */
function writeEnvFile(databaseUrl) {
  const envPath = path.join(process.cwd(), ".env");

  try {
    let envContent = "";

    // Read existing .env file if it exists
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, "utf-8");
    }

    // Check if DATABASE_URL already exists in the file
    const lines = envContent.split("\n");
    let found = false;

    const updatedLines = lines.map((line) => {
      if (line.startsWith("DATABASE_URL=")) {
        found = true;
        return `DATABASE_URL=${databaseUrl}`;
      }
      return line;
    });

    // If DATABASE_URL wasn't found, append it
    if (!found) {
      updatedLines.push(`DATABASE_URL=${databaseUrl}`);
    }

    // Write back to file
    writeFileSync(envPath, updatedLines.join("\n"));

    console.log(
      "✓ Written DATABASE_URL to .env file for Netlify Functions runtime",
    );
  } catch (error) {
    console.warn("Warning: Could not write to .env file:", error.message);
    console.warn(
      "Netlify Functions may not have access to the preview database",
    );
  }
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

    // Calculate hash of current migration files
    console.log("\n📊 Calculating migration hash...");
    const currentHash = calculateMigrationHash();
    console.log(`✓ Migration hash: ${currentHash.substring(0, 12)}...`);

    // Restore cached hash from previous build
    const cacheKey = `pr-${REVIEW_ID}-migration-hash`;
    const cachedHash = await utils.cache.restore([cacheKey]);

    if (hasValue(cachedHash)) {
      console.log(`✓ Found cached hash: ${cachedHash.substring(0, 12)}...`);
    } else {
      console.log("ℹ️  No cached hash found (first build for this PR)");
    }

    const targetDb = `pr_${REVIEW_ID}`;

    // Check if preview database already exists
    const dbExists = await checkDatabaseExists(targetDb);

    if (dbExists) {
      console.log(`✓ Database ${targetDb} exists`);
    } else {
      console.log(`ℹ️  Database ${targetDb} does not exist yet`);
    }

    // Decision matrix for database operations
    let shouldRebuild = false;

    if (!dbExists) {
      // Database doesn't exist - need to create it
      console.log("\n→ Creating new preview database...\n");
      shouldRebuild = true;
    } else if (cachedHash !== currentHash) {
      // Database exists but migrations changed - need to rebuild
      console.log("\n⚠️  Migrations have changed since last build!");
      console.log("→ Rebuilding preview database...\n");
      shouldRebuild = true;

      // Drop existing database before rebuilding
      await dropDatabase(targetDb);
    } else {
      // Database exists and migrations unchanged - reuse it
      console.log("\n✓ Migrations unchanged since last build");
      console.log(`✓ Reusing existing database: ${targetDb}`);
      console.log("→ Skipping database rebuild\n");

      // Set DATABASE_URL to point to existing database
      const databaseUrl = process.env.DATABASE_URL;
      if (hasValue(databaseUrl)) {
        const url = new URL(databaseUrl);
        url.pathname = `/${targetDb}`;
        const newDatabaseUrl = url.toString();

        process.env.DATABASE_URL = newDatabaseUrl;
        console.log(
          "✓ DATABASE_URL updated to use existing preview database\n",
        );

        // Write to .env file so Netlify Functions can access it
        writeEnvFile(newDatabaseUrl);
      }

      // Save database name and hash for next build
      await utils.cache.save(targetDb, ["preview-database-name"]);
      await utils.cache.save(currentHash, [cacheKey]);
      return;
    }

    // If we get here, we need to rebuild the database
    if (shouldRebuild) {
      console.log(`🗄️  Creating preview database for PR #${REVIEW_ID}...\n`);

      const sourceDb = hasValue(inputs.sourceDatabase)
        ? inputs.sourceDatabase
        : "dev";

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

        // Write to .env file so Netlify Functions can access it at runtime
        writeEnvFile(newDatabaseUrl);

        // Store database name and hash for next build
        await utils.cache.save(targetDb, ["preview-database-name"]);
        await utils.cache.save(currentHash, [cacheKey]);
      } else {
        throw new Error("Failed to extract DATABASE_URL from db-spawn output");
      }
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
