import { CockroachDialect } from "@cubos/kysely-cockroach";
import { execSync } from "child_process";
import { readdirSync } from "fs";
import { Kysely, Migrator, type Migration, type MigrationProvider } from "kysely";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

import { hasElements, hasValue, isDefined } from "../lib/checks/checks.js";
import { orderedMigrations } from "./orderedMigrations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationFolder = path.join(__dirname, "/schema");

/**
 * Problems with `orderedMigrations` that would make it lie about what runs:
 * a file it leaves out, an entry with no file, or an entry out of name order.
 * Kysely 0.27 always runs migrations in name order, so the list cannot reorder
 * them — it can only refuse to run while its order and Kysely's disagree.
 */
function findMigrationListProblems(): string[] {
  const files = readdirSync(migrationFolder)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => path.parse(file).name);
  const listed = new Set(orderedMigrations);
  const onDisk = new Set(files);

  return [
    ...files
      .filter((name) => !listed.has(name))
      .map((name) => `${name} is in migrations/schema/ but not in orderedMigrations`),
    ...orderedMigrations
      .filter((name) => !onDisk.has(name))
      .map((name) => `${name} is in orderedMigrations but has no file in migrations/schema/`),
    ...orderedMigrations
      .filter((name, index) => index > 0 && name <= orderedMigrations[index - 1])
      .map(
        (name) =>
          `${name} sorts before the entry above it; rename it to a later date than every migration on main`,
      ),
  ];
}

function assertMigrationListValid() {
  const problems = findMigrationListProblems();
  if (!hasElements(problems)) {
    return;
  }

  console.error("Refusing to migrate: migrations/orderedMigrations.ts is out of step:");
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

/**
 * Reads migrations from `orderedMigrations` rather than the folder, so a
 * migration only exists once it is listed there.
 */
const listedMigrationProvider: MigrationProvider = {
  async getMigrations() {
    const entries = await Promise.all(
      orderedMigrations.map(async (name): Promise<[string, Migration]> => [
        name,
        (await import(path.join(migrationFolder, `${name}.ts`))) as Migration,
      ]),
    );
    return Object.fromEntries(entries);
  },
};

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
    provider: listedMigrationProvider,
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

assertMigrationListValid();

if (process.argv[2] === "down") {
  withMigrator(downgrade).catch(console.error);
} else {
  // Down-migrating against dev stays allowed: it is the cleanup path when a
  // stray migration has already been applied there.
  assertSafeToMigrate();
  withMigrator(migrateToLatest).catch(console.error);
}
