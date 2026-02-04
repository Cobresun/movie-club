import { CockroachDialect } from "@cubos/kysely-cockroach";
import { Kysely, sql } from "kysely";
import { Pool } from "pg";
import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";

// PostgreSQL system catalog types
// Based on: https://www.postgresql.org/docs/current/catalog-pg-database.html
interface PgDatabase {
  datname: string; // Database name
  datdba: number; // Owner OID (use with pg_get_userbyid)
  oid: number; // Database OID (use with obj_description)
}

interface SystemCatalogDB {
  pg_database: PgDatabase;
}

interface DatabaseMetadata {
  created_at?: string;
  created_by?: string;
  pr_number?: number;
  branch?: string;
}

// Zod schema for validating metadata from database comments
// Keep this for runtime validation since it's arbitrary JSON from obj_description
const DatabaseMetadataSchema = z
  .object({
    created_at: z.string().optional(),
    created_by: z.string().optional(),
    pr_number: z.number().optional(),
    branch: z.string().optional(),
  })
  .optional();

interface DatabaseInfo {
  name: string;
  owner: string;
  metadata?: DatabaseMetadata;
}

interface CleanupResult {
  count: number;
  deleted: string[];
}

const PROTECTED_DATABASES = ["dev", "prod", "defaultdb", "postgres", "system"];

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

function buildConnectionString(
  base: ReturnType<typeof parseConnectionString>,
  newDatabase: string,
): string {
  const password = encodeURIComponent(base.password);
  return `postgresql://${base.user}:${password}@${base.host}:${base.port}/${newDatabase}?sslmode=${base.sslmode}`;
}

/**
 * Gets the root database connection URL (pointing to defaultdb for system catalog queries)
 */
function getRootDbUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL_ROOT;
  if (!hasValue(baseUrl)) {
    return undefined;
  }

  const connParams = parseConnectionString(baseUrl);
  return buildConnectionString(connParams, "defaultdb");
}

export const rootPool = new Pool({
  connectionString: getRootDbUrl(),
});

export const rootDialect = new CockroachDialect({
  pool: rootPool,
});

export const rootDb = new Kysely<SystemCatalogDB>({
  dialect: rootDialect,
});

class DatabaseCleanupRepository {
  /**
   * Lists all databases with their metadata
   */
  async listDatabases(): Promise<DatabaseInfo[]> {
    const databases = await rootDb
      .selectFrom("pg_database")
      .select([
        "datname",
        "oid",
        sql<string>`pg_get_userbyid(datdba)`.as("owner"),
        sql<string | null>`obj_description(oid, 'pg_database')`.as(
          "description",
        ),
      ])
      .where("datname", "not in", PROTECTED_DATABASES)
      .where("datname", "not like", "crdb_%")
      .orderBy("datname")
      .execute();

    return databases.map((db) => {
      let metadata: DatabaseMetadata | undefined;

      if (hasValue(db.description)) {
        try {
          metadata = DatabaseMetadataSchema.parse(JSON.parse(db.description));
        } catch {
          metadata = undefined;
        }
      }

      return {
        name: db.datname,
        owner: db.owner,
        metadata,
      };
    });
  }

  /**
   * Lists databases older than the specified number of days
   */
  async listDatabasesOlderThan(days: number): Promise<DatabaseInfo[]> {
    const databases = await this.listDatabases();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return databases.filter((db) => {
      if (!this.canDeleteDatabase(db.name)) {
        return false;
      }

      const createdAt = db.metadata?.created_at;
      if (!hasValue(createdAt)) {
        return false;
      }

      const createdDate = new Date(createdAt);
      return createdDate < cutoffDate;
    });
  }

  /**
   * Validates that a database can be safely deleted
   */
  canDeleteDatabase(dbName: string): boolean {
    if (PROTECTED_DATABASES.includes(dbName)) {
      return false;
    }

    if (!dbName.startsWith("pr_") && !dbName.startsWith("dev_")) {
      return false;
    }

    return true;
  }

  /**
   * Drops a database using Kysely
   */
  async dropDatabase(dbName: string): Promise<void> {
    if (!this.canDeleteDatabase(dbName)) {
      throw new Error(
        `Cannot delete protected database: ${dbName}. Protected databases: ${PROTECTED_DATABASES.join(", ")}`,
      );
    }

    console.log(`Dropping database: ${dbName}...`);

    // Note: CockroachDB doesn't support pg_terminate_backend()
    // We'll try to drop directly and handle any active connection errors
    try {
      // Drop the database using Kysely's sql tag
      await sql`DROP DATABASE IF EXISTS ${sql.id(dbName)}`.execute(rootDb);
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
   * Cleans up databases older than the specified number of days
   */
  async cleanupOldDatabases(olderThanDays: number): Promise<CleanupResult> {
    const toDelete = await this.listDatabasesOlderThan(olderThanDays);

    if (toDelete.length === 0) {
      console.log("No databases to clean up.");
      return { count: 0, deleted: [] };
    }

    // Log what will be deleted
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

    // Delete databases
    const deleted: string[] = [];
    for (const db of toDelete) {
      try {
        await this.dropDatabase(db.name);
        deleted.push(db.name);
      } catch (error) {
        console.error(
          `Failed to drop database ${db.name}:`,
          (error as Error).message,
        );
        // Continue with other databases
      }
    }

    console.log(`\n✓ Successfully deleted ${deleted.length} database(s)`);

    return {
      count: deleted.length,
      deleted,
    };
  }
}

export default new DatabaseCleanupRepository();
export { PROTECTED_DATABASES };
export type { DatabaseInfo, CleanupResult };
