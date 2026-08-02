import { CockroachDbContainer, StartedCockroachDbContainer } from "@testcontainers/cockroachdb";
import { execFileSync } from "child_process";
import type { TestProject } from "vitest/node";

/**
 * The CockroachDB build the integration suite runs against.
 *
 * Pinned rather than floating on `latest` so a Cockroach release can never turn
 * CI red on its own. Override with `COCKROACH_TEST_IMAGE` to reproduce a
 * version-specific bug locally.
 *
 * v25 is the floor: on v24.1 the `20260407_ArbitraryClubLists` migration fails
 * from scratch, because Cockroach still reports `work_list` as depending on
 * `work_list_type` while the `DROP COLUMN` schema-change job is in flight, so
 * the `DROP TYPE` two statements later errors.
 */
const IMAGE = process.env.COCKROACH_TEST_IMAGE ?? "cockroachdb/cockroach:v25.3.3";

let container: StartedCockroachDbContainer | undefined;

/**
 * Boots one throwaway CockroachDB for the whole integration run, migrates it
 * from scratch, and hands the connection string to the workers via `provide`
 * (see `setup/env.ts`, which is what actually points `utils/database.ts` at it).
 *
 * One container for the entire run, not one per file: startup plus migrations
 * costs ~45s, worth paying once. Test isolation comes from `resetDatabase()`
 * between tests instead — see `helpers/database.ts`.
 *
 * Migrations run as a subprocess through `tsx`, exactly as `npm run migrate`
 * does, rather than by importing the migrator here. Kysely's
 * `FileMigrationProvider` `import()`s the migration files through Node's
 * loader, which cannot resolve the extensionless specifiers they use — only
 * esbuild (via tsx) can. Shelling out also guarantees the suite is testing the
 * same schema the deploy applies.
 */
export default async function setup({ provide }: TestProject) {
  container = await new CockroachDbContainer(IMAGE).withDatabase("movie_club_test").start();

  const databaseUrl = container.getConnectionUri();

  try {
    // Captured rather than inherited: a clean migration run prints ~40 lines
    // that would bury the test report. On failure the output is the error.
    execFileSync("npx", ["tsx", "./migrations/schemaMigrator.ts"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
      encoding: "utf-8",
    });
  } catch (error) {
    const failure = error instanceof Error && "stdout" in error ? String(error.stdout) : "";
    throw new Error(`Failed to migrate the test database.\n${failure}`);
  }

  provide("databaseUrl", databaseUrl);
}

export async function teardown() {
  await container?.stop();
}

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string;
  }
}
