import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  readdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import path from "path";
import pg from "pg";

/**
 * Type guard to check if string has value (not null/undefined/empty)
 * @param {string | undefined | null} s
 * @returns {s is string}
 */
function hasValue(s) {
  return typeof s === "string" && s.length > 0;
}

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
 * @typedef {Object} NetlifyConfig
 * @property {Object} build
 * @property {Object} build.environment
 */

/**
 * @typedef {Object} PluginContext
 * @property {NetlifyPluginUtils} utils
 * @property {PluginInputs} inputs
 * @property {NetlifyConfig} netlifyConfig
 */

function calculateMigrationHash() {
  const migrationsDir = path.join(process.cwd(), "migrations", "schema");

  if (!existsSync(migrationsDir)) {
    return "no-migrations";
  }

  try {
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".ts"))
      .sort();

    if (files.length === 0) {
      return "no-migrations";
    }

    const contents = files
      .map((file) => {
        const filePath = path.join(migrationsDir, file);
        return readFileSync(filePath, "utf-8");
      })
      .join("\n");

    const hash = createHash("sha256").update(contents).digest("hex");
    return hash;
  } catch (error) {
    console.warn("Warning: Could not calculate migration hash:", error.message);
    // Return a timestamp-based hash to force rebuild on error
    return `error-${Date.now()}`;
  }
}

async function checkDatabaseExists(dbName) {
  const databaseUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL_ROOT environment variable is not set");
  }

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

async function dropDatabase(dbName) {
  const databaseUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL_ROOT environment variable is not set");
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
 * Writes DATABASE_URL to database-config.json for Netlify Functions to read at runtime
 * @param {string} databaseUrl - The database connection string
 * @returns {void}
 */
function writeDatabaseUrlToConfig(databaseUrl) {
  try {
    const configFilePath = path.join(process.cwd(), "database-config.json");

    // Create JSON config file with DATABASE_URL
    const configContent = JSON.stringify(
      {
        DATABASE_URL: databaseUrl,
      },
      null,
      2,
    );

    writeFileSync(configFilePath, configContent, "utf-8");

    console.log(
      "✓ Wrote DATABASE_URL to database-config.json for Functions runtime",
    );
  } catch (error) {
    console.warn(
      "Warning: Could not write DATABASE_URL to config file:",
      error.message,
    );
    console.warn(
      "Netlify Functions may not have access to the preview database",
    );
  }
}

/**
 * Saves migration hash to a file for Netlify cache
 * @param {string} hash - The migration hash to save
 * @param {string} reviewId - The PR review ID
 * @returns {string} Path to the hash file
 */
function saveHashToFile(hash, reviewId) {
  const cacheDir = path.join(process.cwd(), ".netlify-cache");
  const hashFile = path.join(cacheDir, `pr-${reviewId}-hash.txt`);

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  writeFileSync(hashFile, hash, "utf-8");

  return hashFile;
}

/**
 * Restores migration hash from cached file
 * @param {string} reviewId - The PR review ID
 * @returns {string | null} The cached hash, or null if not found
 */
function restoreHashFromFile(reviewId) {
  const hashFile = path.join(
    process.cwd(),
    ".netlify-cache",
    `pr-${reviewId}-hash.txt`,
  );

  if (existsSync(hashFile)) {
    try {
      return readFileSync(hashFile, "utf-8").trim();
    } catch (error) {
      console.warn("Warning: Could not read cached hash file:", error.message);
      return null;
    }
  }

  return null;
}

/**
 * Checks if there are migration files changed in this PR
 * @returns {boolean}
 */
function checkForMigrations() {
  try {
    // Use git command to check for migration file changes since main branch
    const output = execSync("git diff --name-only origin/main...HEAD", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const changedFiles = output.split("\n").filter((line) => line.trim());
    const migrationFiles = changedFiles.filter(
      (file) => file.startsWith("migrations/schema/") && file.endsWith(".ts"),
    );

    const hasChanges = migrationFiles.length > 0;

    if (hasChanges) {
      console.log(
        `  Found ${migrationFiles.length} changed migration file(s):`,
      );
      migrationFiles.forEach((file) => console.log(`    - ${file}`));
    }

    return hasChanges;
  } catch (error) {
    console.warn(
      "Warning: Could not check for migrations, assuming migrations exist:",
      error instanceof Error ? error.message : String(error),
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
    const hasMigrations = checkForMigrations();

    if (!hasMigrations) {
      console.log("✓ No schema migrations detected, using dev database");

      const databaseUrl = process.env.DATABASE_URL_ROOT;
      if (hasValue(databaseUrl)) {
        const sourceDb = hasValue(inputs.sourceDatabase)
          ? inputs.sourceDatabase
          : "dev";

        const url = new URL(databaseUrl);
        url.pathname = `/${sourceDb}`;
        const devDatabaseUrl = url.toString();

        process.env.DATABASE_URL = devDatabaseUrl;
        writeDatabaseUrlToConfig(devDatabaseUrl);

        console.log(`✓ Using ${sourceDb} database for this deploy preview\n`);
      }

      return;
    }

    console.log("✓ Schema migrations detected!");

    console.log("\n📊 Calculating migration hash...");
    const currentHash = calculateMigrationHash();
    console.log(`✓ Migration hash: ${currentHash.substring(0, 12)}...`);

    const hashFile = path.join(
      process.cwd(),
      ".netlify-cache",
      `pr-${REVIEW_ID}-hash.txt`,
    );

    const restoredFile = await utils.cache.restore(hashFile);
    const cachedHash =
      restoredFile !== false && restoredFile !== null
        ? restoreHashFromFile(REVIEW_ID)
        : null;

    if (hasValue(cachedHash)) {
      console.log(`✓ Found cached hash: ${cachedHash.substring(0, 12)}...`);
    } else {
      console.log("ℹ️  No cached hash found (first build for this PR)");
    }

    const targetDb = `pr_${REVIEW_ID}`;

    const dbExists = await checkDatabaseExists(targetDb);

    if (dbExists) {
      console.log(`✓ Database ${targetDb} exists`);
    } else {
      console.log(`ℹ️  Database ${targetDb} does not exist yet`);
    }

    let shouldRebuild = false;

    if (!dbExists) {
      console.log("\n→ Creating new preview database...\n");
      shouldRebuild = true;
    } else if (cachedHash !== currentHash) {
      console.log("\n⚠️  Migrations have changed since last build!");
      console.log("→ Rebuilding preview database...\n");
      shouldRebuild = true;

      await dropDatabase(targetDb);
    } else {
      console.log("\n✓ Migrations unchanged since last build");
      console.log(`✓ Reusing existing database: ${targetDb}`);
      console.log("→ Skipping database rebuild\n");

      const databaseUrl = process.env.DATABASE_URL_ROOT;
      if (hasValue(databaseUrl)) {
        const url = new URL(databaseUrl);
        url.pathname = `/${targetDb}`;
        const newDatabaseUrl = url.toString();

        process.env.DATABASE_URL = newDatabaseUrl;
        console.log(
          "✓ DATABASE_URL updated to use existing preview database\n",
        );

        writeDatabaseUrlToConfig(newDatabaseUrl);
      }

      await utils.cache.save(targetDb, ["preview-database-name"]);

      // Save current hash to file before caching it
      saveHashToFile(currentHash, REVIEW_ID);
      await utils.cache.save(hashFile);
      return;
    }

    if (shouldRebuild) {
      console.log(`🗄️  Creating preview database for PR #${REVIEW_ID}...\n`);

      const sourceDb = hasValue(inputs.sourceDatabase)
        ? inputs.sourceDatabase
        : "dev";

      const metadata = JSON.stringify({
        created_at: new Date().toISOString(),
        pr_number: parseInt(REVIEW_ID, 10),
        branch: BRANCH ?? "unknown",
        created_by: "netlify-bot",
      });

      const scriptPath = path.join(process.cwd(), "scripts", "db-spawn.ts");
      const cmd = `npx tsx ${scriptPath} ${sourceDb} ${targetDb} --metadata='${metadata}'`;

      const output = execSync(cmd, {
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, CI: "true" },
      });

      const match = /DATABASE_URL=(.+)/.exec(output);
      if (match && match[1]) {
        const newDatabaseUrl = match[1].trim();

        process.env.DATABASE_URL = newDatabaseUrl;

        console.log(`\n✓ Preview database created: ${targetDb}`);
        console.log("✓ DATABASE_URL updated for this build\n");

        writeDatabaseUrlToConfig(newDatabaseUrl);

        await utils.cache.save(targetDb, ["preview-database-name"]);

        // Save current hash to file before caching it
        saveHashToFile(currentHash, REVIEW_ID);
        await utils.cache.save(hashFile);
      } else {
        throw new Error("Failed to extract DATABASE_URL from db-spawn output");
      }
    }
  } catch (error) {
    utils.build.failBuild(
      `Failed to create preview database: ${error.message}`,
    );
  }
};

export { onPreBuild };
