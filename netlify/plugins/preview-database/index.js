import { execSync } from "child_process";
import { createHash } from "crypto";
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import pg from "pg";

import { planDatabaseReuse } from "./planDatabaseReuse.js";

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
 * Mirrors lib/db/poolOptions.ts. This plugin runs as plain Node rather than
 * through tsx, so it cannot import the TypeScript module — keep the two in sync.
 *
 * Without these, `pg` waits forever on both connect and query. Two deploy
 * previews on 2026-07-24 stalled that way for 18 and 27 minutes and burned ~45
 * build minutes between them.
 */
const BUILD_CONNECTION_TIMEOUT_MS = 30_000;
const BUILD_QUERY_TIMEOUT_MS = 60_000;

/** Ceiling for the whole `db-spawn` subprocess (BACKUP restore included). */
const SPAWN_SUBPROCESS_TIMEOUT_MS = 600_000;

/**
 * @returns {string} DATABASE_URL_ROOT, or throws if it is not configured.
 */
function ensureRootUrl() {
  const databaseUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL_ROOT environment variable is not set");
  }
  return databaseUrl;
}

/**
 * Opens an admin pool against `defaultdb` with build-safe timeouts.
 * @param {string} [database] - Database to connect to; defaults to `defaultdb`.
 * @returns {InstanceType<typeof Pool>}
 */
function openPool(database = "defaultdb") {
  const url = new URL(ensureRootUrl());
  url.pathname = `/${database}`;

  return new Pool({
    connectionString: url.toString(),
    connectionTimeoutMillis: BUILD_CONNECTION_TIMEOUT_MS,
    query_timeout: BUILD_QUERY_TIMEOUT_MS,
  });
}

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

/**
 * Hashes each migration file individually.
 *
 * A single blob hash over every file can only answer "did anything change?",
 * which forces a full drop-and-restore for any edit. Per-file hashes let us ask
 * the sharper question — *which* migrations changed, and have any of them
 * already been applied to the preview database — so an additive change can skip
 * the restore entirely.
 *
 * @returns {Record<string, string>} Migration file name → sha256 of its contents.
 */
function buildMigrationManifest() {
  const migrationsDir = path.join(process.cwd(), "migrations", "schema");

  if (!existsSync(migrationsDir)) {
    return {};
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort();

  /** @type {Record<string, string>} */
  const manifest = {};

  for (const file of files) {
    const contents = readFileSync(path.join(migrationsDir, file), "utf-8");
    manifest[file] = createHash("sha256").update(contents).digest("hex");
  }

  return manifest;
}

async function checkDatabaseExists(dbName) {
  const pool = openPool();

  try {
    const result = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    await pool.end();
  }
}

async function dropDatabase(dbName) {
  const pool = openPool();

  try {
    console.log(`🗑️  Dropping existing database ${dbName}...`);
    await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✓ Database dropped: ${dbName}`);
  } finally {
    await pool.end();
  }
}

/**
 * Reads the migrations already applied to a preview database, in the order
 * Kysely applied them (it sorts by file name).
 *
 * @param {string} dbName
 * @returns {Promise<string[]>} Applied migration names, oldest first.
 */
async function getAppliedMigrations(dbName) {
  const pool = openPool(dbName);

  try {
    const result = await pool.query("SELECT name FROM kysely_migration ORDER BY name ASC");
    return result.rows.map((row) => row.name);
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

    console.log("✓ Wrote DATABASE_URL to database-config.json for Functions runtime");
  } catch (error) {
    console.warn("Warning: Could not write DATABASE_URL to config file:", error.message);
    console.warn("Netlify Functions may not have access to the preview database");
  }
}

/**
 * Path of the per-PR migration manifest inside the Netlify build cache.
 * @param {string} reviewId - The PR review ID
 * @returns {string}
 */
function manifestPath(reviewId) {
  return path.join(process.cwd(), ".netlify-cache", `pr-${reviewId}-migrations.json`);
}

/**
 * Writes the migration manifest to the Netlify cache directory.
 * @param {Record<string, string>} manifest
 * @param {string} reviewId - The PR review ID
 * @returns {string} Path to the manifest file
 */
function saveManifestToFile(manifest, reviewId) {
  const file = manifestPath(reviewId);

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2), "utf-8");

  return file;
}

/**
 * Reads the manifest cached by the previous build.
 *
 * Returns null when it is missing or unreadable — including the one-time case of
 * a PR whose cache still holds the old single-hash `.txt` format. Callers treat
 * null as "rebuild from scratch", so a stale cache costs one restore, never
 * correctness.
 *
 * @param {string} reviewId - The PR review ID
 * @returns {Record<string, string> | null}
 */
function restoreManifestFromFile(reviewId) {
  const file = manifestPath(reviewId);

  if (!existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    console.warn("Warning: Could not read cached migration manifest:", error.message);
    return null;
  }
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
      console.log(`  Found ${migrationFiles.length} changed migration file(s):`);
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
const onPreBuild = async ({ utils, inputs, netlifyConfig }) => {
  const { CONTEXT, REVIEW_ID, BRANCH } = process.env;

  if (CONTEXT !== "deploy-preview") {
    console.log("Skipping preview database setup (not a deploy preview)");
    return;
  }

  if (!hasValue(REVIEW_ID)) {
    console.log("Warning: REVIEW_ID not available, skipping preview database setup");
    return;
  }

  console.log("\n🔍 Checking for schema migrations...");

  try {
    const hasMigrations = checkForMigrations();

    if (!hasMigrations) {
      console.log("✓ No schema migrations detected, using dev database");

      const databaseUrl = process.env.DATABASE_URL_ROOT;
      if (hasValue(databaseUrl)) {
        const sourceDb = hasValue(inputs.sourceDatabase) ? inputs.sourceDatabase : "dev";

        const url = new URL(databaseUrl);
        url.pathname = `/${sourceDb}`;
        const devDatabaseUrl = url.toString();

        process.env.DATABASE_URL = devDatabaseUrl;
        writeDatabaseUrlToConfig(devDatabaseUrl);

        console.log(`✓ Using ${sourceDb} database for this deploy preview\n`);
      }

      // Tell the build command it can skip `npm run migrate` entirely. Shared
      // `dev` is already at main's schema (the onSuccess hook below keeps it
      // there), and with no migration diff there is nothing for the migrator to
      // apply and no way for the committed types to have gone stale. Skipping
      // saves a tsx cold start, a CockroachDB round trip and a full
      // introspection on the ~90% of previews that touch no migrations.
      //
      // Only ever set in this branch: every other path leaves it unset and the
      // build migrates as before, so a plugin failure degrades to the old
      // behaviour rather than silently skipping a needed migration.
      netlifyConfig.build.environment.SKIP_SCHEMA_MIGRATE = "true";

      return;
    }

    console.log("✓ Schema migrations detected!");

    console.log("\n📊 Hashing migration files...");
    const manifest = buildMigrationManifest();
    console.log(`✓ Hashed ${Object.keys(manifest).length} migration file(s)`);

    const cacheFile = manifestPath(REVIEW_ID);

    const restoredFile = await utils.cache.restore(cacheFile);
    const cachedManifest =
      restoredFile !== false && restoredFile !== null ? restoreManifestFromFile(REVIEW_ID) : null;

    if (cachedManifest === null) {
      console.log("ℹ️  No cached manifest found (first build for this PR)");
    } else {
      console.log(`✓ Found cached manifest (${Object.keys(cachedManifest).length} file(s))`);
    }

    const targetDb = `pr_${REVIEW_ID}`;
    const dbExists = await checkDatabaseExists(targetDb);

    /**
     * Points DATABASE_URL (and the Functions runtime config) at the preview
     * database and persists the manifest for the next build.
     * @param {string} databaseUrl
     */
    const adoptDatabase = async (databaseUrl) => {
      process.env.DATABASE_URL = databaseUrl;
      writeDatabaseUrlToConfig(databaseUrl);

      await utils.cache.save(targetDb, ["preview-database-name"]);
      saveManifestToFile(manifest, REVIEW_ID);
      await utils.cache.save(cacheFile);
    };

    if (dbExists) {
      console.log(`✓ Database ${targetDb} exists`);

      // Restoring from an S3 backup costs ~100s of build time. When this build
      // only *adds* migrations, the existing database can be advanced in place
      // and the build's `npm run migrate` does the rest for free.
      let plan;
      try {
        const applied = await getAppliedMigrations(targetDb);
        plan = planDatabaseReuse({ manifest, cachedManifest, applied });
      } catch (error) {
        plan = { reuse: false, reason: `could not inspect applied migrations: ${error.message}` };
      }

      if (plan.reuse) {
        const url = new URL(ensureRootUrl());
        url.pathname = `/${targetDb}`;

        console.log("\n✓ Applied migrations are unchanged; new ones will be applied by the build");
        console.log(`✓ Reusing existing database: ${targetDb}`);
        console.log("→ Skipping database rebuild\n");

        await adoptDatabase(url.toString());
        return;
      }

      console.log(`\n⚠️  Cannot reuse ${targetDb}: ${plan.reason}`);
      console.log("→ Rebuilding preview database from snapshot...\n");

      await dropDatabase(targetDb);
    } else {
      console.log(`ℹ️  Database ${targetDb} does not exist yet`);
      console.log("\n→ Creating new preview database...\n");
    }

    console.log(`🗄️  Creating preview database for PR #${REVIEW_ID}...\n`);

    const sourceDb = hasValue(inputs.sourceDatabase) ? inputs.sourceDatabase : "dev";

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
      // A wedged RESTORE would otherwise bill build minutes until Netlify's own
      // timeout fires. db-spawn's pool has its own query deadline; this is the
      // backstop for the whole subprocess.
      timeout: SPAWN_SUBPROCESS_TIMEOUT_MS,
    });

    const match = /DATABASE_URL=(.+)/.exec(output);
    if (!match || !match[1]) {
      throw new Error("Failed to extract DATABASE_URL from db-spawn output");
    }

    console.log(`\n✓ Preview database created: ${targetDb}`);
    console.log("✓ DATABASE_URL updated for this build\n");

    await adoptDatabase(match[1].trim());
  } catch (error) {
    utils.build.failBuild(`Failed to create preview database: ${error.message}`);
  }
};

/**
 * After a successful production deploy, advance the shared `dev` database to
 * the latest schema.
 *
 * The production build already migrates the *production* database (via
 * `npm run migrate`), and migration-carrying deploy previews migrate their own
 * spawned `pr_<id>` database. But nothing keeps shared `dev` — the database
 * every *non-migration* deploy preview (and local development) points at — in
 * sync with `main`. Without this hook `dev` silently falls a migration behind
 * on every merge until someone runs `migrate:dev` by hand, and until they do,
 * every non-migration preview 500s on the newly-required column.
 *
 * This is deliberately non-fatal: production is already migrated by the build
 * step, so a failure here must not fail an otherwise-successful deploy. A stale
 * `dev` only affects preview/local environments and is recoverable with
 * `npm run migrate:dev`. We therefore log loudly and return rather than
 * `failBuild`. The migrator itself is safe to run on every production deploy:
 * when `dev` is already current it is a no-op, and its built-in guard only
 * blocks migrations that are not on `origin/main` (never the case on a `main`
 * build).
 *
 * @param {PluginContext} context
 * @returns {void}
 */
const onSuccess = ({ inputs }) => {
  const { CONTEXT } = process.env;

  if (CONTEXT !== "production") {
    return;
  }

  const rootUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(rootUrl)) {
    console.warn("Warning: DATABASE_URL_ROOT not set; skipping shared dev migration sync");
    return;
  }

  const sourceDb = hasValue(inputs.sourceDatabase) ? inputs.sourceDatabase : "dev";

  const url = new URL(rootUrl);
  url.pathname = `/${sourceDb}`;
  const devDatabaseUrl = url.toString();

  console.log(`\n🔄 Syncing schema migrations to shared ${sourceDb} database...`);

  try {
    const scriptPath = path.join(process.cwd(), "migrations", "schemaMigrator.ts");

    // Stream the migrator's output straight to the build log so its progress
    // (and any failure detail) is visible without re-capturing it here.
    execSync(`npx tsx ${scriptPath}`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: devDatabaseUrl },
    });

    console.log(`✓ Shared ${sourceDb} database is up to date\n`);
  } catch (error) {
    // Non-fatal: production is already migrated by the build step, so a failure
    // here must not fail the deploy. A stale `dev` only affects preview/local
    // environments and is recoverable with `npm run migrate:dev`.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to sync migrations to the shared ${sourceDb} database: ${message}`);
    console.warn("   Production is unaffected. Run `npm run migrate:dev` to sync manually.");
  }
};

export { onPreBuild, onSuccess };
