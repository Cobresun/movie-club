import { CockroachDialect } from "@cubos/kysely-cockroach";
import { execSync } from "child_process";
import { promises as fs, readdirSync } from "fs";
import { Kysely, Migrator, FileMigrationProvider } from "kysely";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

import { hasElements, hasValue, isDefined } from "../lib/checks/checks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationFolder = path.join(__dirname, "/schema");

/**
 * Lists migration files that exist locally but not on origin/main.
 * Returns null if the comparison fails (e.g. git unavailable or
 * origin/main not fetched), in which case the guard fails open.
 */
function listMigrationsNotOnMain(): string[] | null {
  try {
    const onMain = new Set(
      execSync("git ls-tree -r --name-only origin/main -- migrations/schema", {
        encoding: "utf-8",
        stdio: "pipe",
      })
        .split("\n")
        .map((line) => path.basename(line.trim()))
        .filter(hasValue),
    );

    return readdirSync(migrationFolder).filter((file) => file.endsWith(".ts") && !onMain.has(file));
  } catch {
    return null;
  }
}

/**
 * Refuses to apply migrations that aren't on origin/main against the shared
 * `dev` database. Every deploy preview without schema changes points straight
 * at `dev`, so a stray migration there leaves an orphaned row in
 * kysely_migration and breaks every other open PR's preview build.
 */
function assertSafeToMigrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!hasValue(databaseUrl)) {
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(databaseUrl).pathname;
  } catch {
    return;
  }

  if (pathname !== "/dev") {
    return;
  }

  if (process.env.FORCE_DEV_MIGRATE === "1") {
    console.warn("⚠️  FORCE_DEV_MIGRATE=1 set: skipping shared dev database guard");
    return;
  }

  const newMigrations = listMigrationsNotOnMain();

  if (newMigrations === null) {
    console.warn(
      "Warning: could not compare migrations against origin/main; " +
        "skipping shared dev database guard",
    );
    return;
  }

  if (!hasElements(newMigrations)) {
    return;
  }

  console.error("Refusing to migrate: DATABASE_URL points at the shared `dev` database,");
  console.error("but these migrations do not exist on origin/main:");
  newMigrations.forEach((file) => console.error(`  - ${file}`));
  console.error("");
  console.error("Applying them would break deploy previews for every other open PR.");
  console.error("Test new migrations against a spawned database instead:");
  console.error("  npm run db:spawn my_feature");
  console.error(
    "  DATABASE_URL='<spawned-url>' npx tsx --env-file=.env ./migrations/schemaMigrator.ts",
  );
  console.error("");
  console.error("If the migration was merged but your origin/main is stale, run `git fetch`.");
  console.error("To bypass intentionally, set FORCE_DEV_MIGRATE=1.");
  process.exit(1);
}

async function withMigrator(next: (migrator: Migrator) => Promise<void>) {
  const db = new Kysely<unknown>({
    dialect: new CockroachDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  });

  await next(migrator);
  await db.destroy();
}

async function migrateToLatest(migrator: Migrator) {
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (isDefined(error)) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }
}

async function downgrade(migrator: Migrator) {
  const { error, results } = await migrator.migrateDown();
  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was successfully downgraded`);
    } else if (it.status === "Error") {
      console.error(`failed to downgrade migration "${it.migrationName}"`);
    }
  });

  if (isDefined(error)) {
    console.error("failed to downgrade");
    console.error(error);
    process.exit(1);
  }
}

if (process.argv[2] === "down") {
  withMigrator(downgrade).catch(console.error);
} else {
  // Down-migrating against dev stays allowed: it is the cleanup path when a
  // stray migration has already been applied there.
  assertSafeToMigrate();
  withMigrator(migrateToLatest).catch(console.error);
}
