import { CockroachDialect } from "@cubos/kysely-cockroach";
import { promises as fs } from "fs";
import { Kysely, Migrator, FileMigrationProvider } from "kysely";
import * as path from "path";
import { Pool } from "pg";

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
      migrationFolder: path.join(__dirname, "/schema"),
    }),
  });

  await next(migrator);
  db.destroy();
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

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }
}

async function downgrade(migrator: Migrator) {
  const { error, results } = await migrator.migrateDown();
  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(
        `migration "${it.migrationName}" was successfully downgraded`,
      );
    } else if (it.status === "Error") {
      console.error(`failed to downgrade migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to downgrade");
    console.error(error);
    process.exit(1);
  }
}

if (process.argv[2] === "down") {
  withMigrator(downgrade);
} else {
  withMigrator(migrateToLatest);
}
