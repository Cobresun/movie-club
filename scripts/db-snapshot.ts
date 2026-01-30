#!/usr/bin/env tsx

import { Pool } from "pg";

import { hasValue } from "../lib/checks/checks.js";

const S3_BUCKET = "movie-club-crdb-dev-exports";
const MAX_SNAPSHOTS = 5;

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
 * Lists all existing backup snapshots in S3
 */
async function listSnapshots(pool: Pool, s3Uri: string): Promise<string[]> {
  try {
    const result = await pool.query<{ path: string }>(
      `SHOW BACKUPS IN '${s3Uri}'`,
    );
    return result.rows.map((row) => row.path);
  } catch (error) {
    // If no backups exist yet, SHOW BACKUPS might error
    if ((error as Error).message.includes("no backup")) {
      return [];
    }
    throw error;
  }
}

/**
 * Creates a new snapshot backup of the specified database
 */
async function createSnapshot(
  pool: Pool,
  dbName: string,
  s3Uri: string,
): Promise<string> {
  console.log(`Creating snapshot of database: ${dbName}...`);

  await pool.query(`
    BACKUP DATABASE ${dbName} 
    INTO '${s3Uri}' 
    AS OF SYSTEM TIME '-10s'
  `);

  // Get the newly created snapshot path
  const snapshots = await listSnapshots(pool, s3Uri);
  const latestSnapshot = snapshots[snapshots.length - 1];

  if (!hasValue(latestSnapshot)) {
    throw new Error("Failed to create snapshot - no backup found after BACKUP");
  }

  console.log(`✓ Snapshot created: ${latestSnapshot}`);
  return latestSnapshot;
}

/**
 * Main snapshot function
 */
async function snapshotDatabase(dbName: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const s3Uri = buildS3Uri(S3_BUCKET);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log(`\n📸 Snapshotting database: ${dbName}`);
    console.log(`S3 bucket: ${S3_BUCKET}\n`);

    // Create snapshot
    await createSnapshot(pool, dbName, s3Uri);

    // Show current snapshots
    const snapshots = await listSnapshots(pool, s3Uri);
    console.log(`\nCurrent snapshots (${snapshots.length}):`);
    snapshots.forEach((s) => console.log(`  - ${s}`));

    if (snapshots.length > MAX_SNAPSHOTS) {
      console.log(
        `\n⚠️  Note: You have ${snapshots.length} snapshots (keeping last ${MAX_SNAPSHOTS} is recommended).`,
      );
      console.log(
        `   Manually delete old snapshots from S3 if needed to save storage costs.`,
      );
    }

    console.log("\n✓ Snapshot complete!\n");
  } finally {
    await pool.end();
  }
}

/**
 * CLI entry point
 */
async function main() {
  const dbName = process.argv[2] ?? "dev";

  console.log("Usage: npm run db:snapshot [database_name]");
  console.log(
    'Example: npm run db:snapshot dev (or just "npm run db:snapshot")',
  );
  console.log("");

  try {
    await snapshotDatabase(dbName);
  } catch (error) {
    console.error("\n✗ Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { snapshotDatabase, listSnapshots, buildS3Uri };
