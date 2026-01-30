#!/usr/bin/env tsx

import { Pool } from "pg";

import { hasValue } from "../lib/checks/checks.js";

interface DatabaseInfo {
  name: string;
  owner: string;
  size: string;
  metadata?: {
    created_at?: string;
    created_by?: string;
    pr_number?: number;
    branch?: string;
  };
}

const PROTECTED_DATABASES = ["defaultdb", "postgres", "system"];

/**
 * Formats a date string to be human-readable
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

/**
 * Lists all databases with their metadata
 */
async function listDatabases(): Promise<DatabaseInfo[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Query for all databases with their metadata
    // Note: CockroachDB Serverless doesn't support pg_database_size for individual databases
    const result = await pool.query<{
      datname: string;
      pg_get_userbyid: string;
      description: string | null;
    }>(
      `
      SELECT 
        d.datname,
        pg_get_userbyid(d.datdba) as owner,
        obj_description(d.oid, 'pg_database') as description
      FROM pg_database d
      WHERE d.datname NOT IN (${PROTECTED_DATABASES.map((_, i) => `$${i + 1}`).join(", ")})
        AND d.datname NOT LIKE 'crdb_%'
      ORDER BY d.datname
    `,
      PROTECTED_DATABASES,
    );

    return result.rows.map((row) => {
      let metadata: DatabaseInfo["metadata"];

      const description = row.description;
      if (hasValue(description)) {
        try {
          metadata = JSON.parse(description) as DatabaseInfo["metadata"];
        } catch {
          // Not JSON, ignore
        }
      }

      return {
        name: row.datname,
        owner: row.pg_get_userbyid,
        size: "N/A", // CockroachDB Serverless doesn't expose individual DB sizes
        metadata,
      };
    });
  } finally {
    await pool.end();
  }
}

/**
 * Displays databases in a formatted table
 */
function displayDatabases(databases: DatabaseInfo[]): void {
  if (databases.length === 0) {
    console.log("No databases found.");
    return;
  }

  console.log("\n📊 Database List\n");
  console.log("─".repeat(80));

  // Group databases by type
  const prodDatabases = databases.filter((db) => db.name === "prod");
  const devDatabases = databases.filter((db) => db.name === "dev");
  const prDatabases = databases.filter((db) => db.name.startsWith("pr_"));
  const personalDatabases = databases.filter((db) =>
    db.name.startsWith("dev_"),
  );
  const otherDatabases = databases.filter(
    (db) =>
      !db.name.startsWith("pr_") &&
      !db.name.startsWith("dev_") &&
      db.name !== "dev" &&
      db.name !== "prod",
  );

  // Display production database
  if (prodDatabases.length > 0) {
    console.log("\n🚀 Production Database:");
    prodDatabases.forEach((db) => displayDatabase(db));
  }

  // Display main dev database
  if (devDatabases.length > 0) {
    console.log("\n🔧 Main Development Database:");
    devDatabases.forEach((db) => displayDatabase(db));
  }

  // Display PR preview databases
  if (prDatabases.length > 0) {
    console.log("\n🔀 PR Preview Databases:");
    prDatabases.forEach((db) => displayDatabase(db));
  }

  // Display personal dev databases
  if (personalDatabases.length > 0) {
    console.log("\n👤 Personal Development Databases:");
    personalDatabases.forEach((db) => displayDatabase(db));
  }

  // Display other databases
  if (otherDatabases.length > 0) {
    console.log("\n📦 Other Databases:");
    otherDatabases.forEach((db) => displayDatabase(db));
  }

  console.log("\n" + "─".repeat(80) + "\n");

  // Display summary
  console.log(`Total: ${databases.length} databases`);
  console.log();
}

/**
 * Displays a single database entry
 */
function displayDatabase(db: DatabaseInfo): void {
  let info = `  ${db.name.padEnd(40)}`;

  const createdAt = db.metadata?.created_at;
  if (hasValue(createdAt)) {
    const age = formatDate(createdAt);
    info += `  (${age})`;
  }

  const createdBy = db.metadata?.created_by;
  if (hasValue(createdBy)) {
    info += `  by ${createdBy}`;
  }

  const prNumber = db.metadata?.pr_number;
  if (typeof prNumber === "number" && prNumber !== 0) {
    info += `  PR #${prNumber}`;
  }

  const branch = db.metadata?.branch;
  if (hasValue(branch)) {
    info += `  [${branch}]`;
  }

  console.log(info);
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    const databases = await listDatabases();

    if (args.includes("--json")) {
      console.log(JSON.stringify(databases, null, 2));
    } else {
      displayDatabases(databases);
    }
  } catch (error) {
    console.error("✗ Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { listDatabases };
