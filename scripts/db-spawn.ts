#!/usr/bin/env tsx

import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import * as readline from "readline/promises";

import { ensure, hasValue } from "../lib/checks/checks.js";

interface SpawnOptions {
  sourceDb: string;
  targetDb: string;
  metadata?: string;
  replace?: boolean;
}

interface DbMetadata {
  created_at: string;
  created_by?: string;
  pr_number?: number;
  branch?: string;
}

const PROTECTED_DATABASES = ["dev", "prod", "defaultdb", "postgres", "system"];
const S3_BUCKET = ensure(
  process.env.COCKROACH_BACKUP_BUCKET_NAME,
  "COCKROACH_BACKUP_BUCKET_NAME environment variable is not set",
);

/**
 * Parses a PostgreSQL connection string and returns its components
 */
function parseConnectionString(connString: string): {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
  sslmode: string;
} {
  const url = new URL(connString);
  const params = new URLSearchParams(url.search);

  return {
    user: url.username,
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port !== "" ? url.port : "26257",
    database: url.pathname.slice(1), // Remove leading slash
    sslmode: params.get("sslmode") ?? "verify-full",
  };
}

/**
 * Builds a new connection string with a different database name
 */
function buildConnectionString(
  base: ReturnType<typeof parseConnectionString>,
  newDatabase: string,
): string {
  const password = encodeURIComponent(base.password);
  return `postgresql://${base.user}:${password}@${base.host}:${base.port}/${newDatabase}?sslmode=${base.sslmode}`;
}

/**
 * Validates database name (no special chars, reasonable length)
 */
function validateDatabaseName(name: string): void {
  if (PROTECTED_DATABASES.includes(name)) {
    throw new Error(
      `Cannot use protected database name: ${name}. Protected databases: ${PROTECTED_DATABASES.join(", ")}`,
    );
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(
      `Invalid database name: ${name}. Must contain only lowercase letters, numbers, and underscores.`,
    );
  }

  if (name.length > 63) {
    throw new Error(
      `Database name too long: ${name}. Maximum length is 63 characters.`,
    );
  }
}

/**
 * Checks if a database exists
 */
async function databaseExists(pool: Pool, dbName: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Builds S3 URI with AWS credentials from environment variables
 */
function buildS3Uri(bucket: string): string {
  const accessKey = process.env.AWS_ACCESS_KEY_COCKROACH_BACKUP;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP;

  if (!hasValue(accessKey)) {
    throw new Error(
      "AWS_ACCESS_KEY_COCKROACH_BACKUP environment variable is not set",
    );
  }

  if (!hasValue(secretKey)) {
    throw new Error(
      "AWS_SECRET_ACCESS_KEY_COCKROACH_BACKUP environment variable is not set",
    );
  }

  const encodedSecret = encodeURIComponent(secretKey);
  return `s3://${bucket}?AWS_ACCESS_KEY_ID=${accessKey}&AWS_SECRET_ACCESS_KEY=${encodedSecret}`;
}

/**
 * Finds the latest snapshot in S3
 */
async function findLatestSnapshot(
  pool: Pool,
  s3Uri: string,
): Promise<string | undefined> {
  try {
    const result = await pool.query<{ path: string }>(
      `SHOW BACKUPS IN '${s3Uri}'`,
    );
    const snapshots = result.rows.map((row) => row.path);
    return snapshots[snapshots.length - 1]; // Latest is last
  } catch (error) {
    // If no backups exist, return undefined
    if ((error as Error).message.includes("no backup")) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Restores database from S3 snapshot
 */
async function restoreFromSnapshot(
  pool: Pool,
  sourceDb: string,
  targetDb: string,
  s3Uri: string,
  latestSnapshot: string,
): Promise<void> {
  console.log(`Restoring ${sourceDb} from snapshot: ${latestSnapshot}...`);

  await pool.query(`
    RESTORE DATABASE ${sourceDb} 
    FROM '${latestSnapshot}' IN '${s3Uri}' 
    WITH new_db_name = '${targetDb}'
  `);

  console.log(`✓ Database restored: ${targetDb}`);
}

/**
 * Adds metadata comment to database
 */
async function addDatabaseMetadata(
  pool: Pool,
  dbName: string,
  metadata: DbMetadata,
): Promise<void> {
  const comment = JSON.stringify(metadata);
  await pool.query(`COMMENT ON DATABASE ${dbName} IS '${comment}'`);
}

/**
 * Main spawn function
 */
async function spawnDatabase(options: SpawnOptions): Promise<string> {
  const {
    sourceDb,
    targetDb,
    metadata: metadataArg,
    replace = false,
  } = options;

  validateDatabaseName(targetDb);

  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const connParams = parseConnectionString(databaseUrl);

  // Create admin connection pool (connects to defaultdb)
  const adminConnString = buildConnectionString(connParams, "defaultdb");
  const adminPool = new Pool({ connectionString: adminConnString });

  try {
    // Check if target already exists
    const exists = await databaseExists(adminPool, targetDb);

    if (exists) {
      if (replace) {
        console.log(`Database ${targetDb} exists. Replacing...`);
        await adminPool.query(`DROP DATABASE ${targetDb}`);
        console.log(`✓ Dropped existing database: ${targetDb}`);
      } else {
        throw new Error(
          `Database ${targetDb} already exists. Please choose a different name or clean it up first.`,
        );
      }
    }

    // Build S3 URI
    const s3Uri = buildS3Uri(S3_BUCKET);

    // Find latest snapshot
    const latestSnapshot = await findLatestSnapshot(adminPool, s3Uri);
    if (!hasValue(latestSnapshot)) {
      throw new Error(
        `No snapshots found for database '${sourceDb}' in S3.\n` +
          `Run 'npm run db:snapshot ${sourceDb}' first to create a snapshot.`,
      );
    }

    // Restore from snapshot with new database name
    await restoreFromSnapshot(
      adminPool,
      sourceDb,
      targetDb,
      s3Uri,
      latestSnapshot,
    );

    // Add metadata comment
    const metadata: DbMetadata = {
      created_at: new Date().toISOString(),
      created_by: getUsername(),
    };

    if (hasValue(metadataArg)) {
      try {
        const parsed = JSON.parse(metadataArg) as Partial<DbMetadata>;
        Object.assign(metadata, parsed);
      } catch {
        // If metadata is not JSON, ignore it
      }
    }

    await addDatabaseMetadata(adminPool, targetDb, metadata);

    // Build the new connection string
    const newConnString = buildConnectionString(connParams, targetDb);

    console.log("\n✓ Database spawn complete!");
    console.log(`\nNew DATABASE_URL:\n${newConnString}\n`);

    return newConnString;
  } finally {
    await adminPool.end();
  }
}

/**
 * Gets the current username from git config or environment
 */
function getUsername(): string {
  try {
    const gitUser = execSync("git config user.name", { encoding: "utf-8" })
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (gitUser) return gitUser;
  } catch {
    // Git config not available
  }

  // Fallback to environment
  const user = process.env.USER;
  const username = process.env.USERNAME;
  return hasValue(user) ? user : hasValue(username) ? username : "unknown";
}

/**
 * Prompts user for input
 */
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/**
 * Updates local .env file with new DATABASE_URL
 */
function updateEnvFile(newDatabaseUrl: string): void {
  const envPath = join(process.cwd(), ".env");

  try {
    const envContent = readFileSync(envPath, "utf-8");

    // Replace DATABASE_URL line
    const lines = envContent.split("\n");
    const updatedLines = lines.map((line) => {
      if (line.startsWith("DATABASE_URL=")) {
        return `DATABASE_URL=${newDatabaseUrl}`;
      }
      return line;
    });

    writeFileSync(envPath, updatedLines.join("\n"));
    console.log(`✓ Updated .env file with new DATABASE_URL`);
  } catch {
    console.warn(
      `Warning: Could not update .env file. Please update DATABASE_URL manually.`,
    );
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: npm run db:spawn <feature-name>");
    console.log("\nExamples:");
    console.log("  npm run db:spawn my_feature");
    console.log(
      "\nFor Netlify/CI use: tsx scripts/db-spawn.ts <source> <target> [--metadata='{json}'] [--replace]",
    );
    process.exit(1);
  }

  const metadataArg = args.find((arg) => arg.startsWith("--metadata="));
  const replaceFlag = args.includes("--replace");

  let sourceDb: string;
  let targetDb: string;
  let metadata: string | undefined;

  if (args.length >= 2 && !args[1].startsWith("--")) {
    // CI/Script mode: tsx scripts/db-spawn.ts <source> <target>
    sourceDb = args[0];
    targetDb = args[1];
    metadata = metadataArg?.split("=")[1];
  } else {
    // Developer mode: npm run db:spawn <feature-name>
    const featureName = args[0].replace(/^--/, "");
    const username = getUsername();

    sourceDb = "dev";
    targetDb = `dev_${username}_${featureName}`;

    console.log(`Creating personal development database: ${targetDb}`);
    console.log(`Source: ${sourceDb} (from latest snapshot)\n`);
  }

  try {
    const newConnString = await spawnDatabase({
      sourceDb,
      targetDb,
      metadata,
      replace: replaceFlag,
    });

    // Only update .env in developer mode (not CI)
    if (!hasValue(metadataArg) && process.env.CI !== "true") {
      const shouldUpdate = await prompt(
        "\nUpdate your local .env file with this DATABASE_URL? (y/n): ",
      );

      if (shouldUpdate.toLowerCase() === "y") {
        updateEnvFile(newConnString);
      }
    }

    // Output connection string for CI/scripts to capture
    if (process.env.CI === "true" || hasValue(metadataArg)) {
      console.log(`\nDATABASE_URL=${newConnString}`);
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

export { spawnDatabase, parseConnectionString, buildConnectionString };
