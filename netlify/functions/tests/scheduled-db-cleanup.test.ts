/**
 * Integration tests for `netlify/functions/scheduled-db-cleanup.ts`.
 *
 * The cleanup reads `SHOW DATABASES WITH COMMENT` and issues `DROP DATABASE`,
 * so it only means anything against a real cluster. These tests create throwaway
 * `pr_*` databases on the test container, comment them with the metadata the
 * preview-database plugin writes, and check which ones survive.
 *
 * The raw SQL here is deliberate and has no API alternative: the subject under
 * test operates on databases, not on rows, and the Netlify plugin that creates
 * preview databases is the only thing that ever issues these statements in
 * production. Assertions still go through `DatabaseCleanupRepository`, which is
 * the interface the scheduled function itself uses.
 */
import { sql } from "kysely";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import DatabaseCleanupRepository, {
  rootDb,
  rootPool,
} from "../repositories/DatabaseCleanupRepository";
import cleanupHandler from "../scheduled-db-cleanup";

const created: string[] = [];

async function createPreviewDatabase(name: string, createdAt: Date) {
  await sql`CREATE DATABASE IF NOT EXISTS ${sql.id(name)}`.execute(rootDb);
  await sql`COMMENT ON DATABASE ${sql.id(name)} IS ${sql.lit(
    JSON.stringify({ created_at: createdAt.toISOString(), created_by: "tests", pr_number: 1 }),
  )}`.execute(rootDb);
  created.push(name);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function scheduledRequest(body: unknown) {
  return new Request("https://localhost/.netlify/functions/scheduled-db-cleanup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  for (const name of created.splice(0)) {
    await sql`DROP DATABASE IF EXISTS ${sql.id(name)}`.execute(rootDb);
  }
});

afterAll(async () => {
  await rootPool.end();
});

describe("scheduled database cleanup", () => {
  it("drops preview databases past the retention window and keeps the rest", async () => {
    await createPreviewDatabase("pr_stale_cleanup_test", daysAgo(30));
    await createPreviewDatabase("pr_fresh_cleanup_test", daysAgo(1));

    const response = await cleanupHandler(scheduledRequest({ next_run: "2026-01-01T00:00:00Z" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, count: 1, deleted: ["pr_stale_cleanup_test"] });

    const remaining = await DatabaseCleanupRepository.listDatabases();
    const names = remaining.map((database) => database.name);
    expect(names).toContain("pr_fresh_cleanup_test");
    expect(names).not.toContain("pr_stale_cleanup_test");
  });

  it("leaves databases whose comment carries no creation date", async () => {
    await sql`CREATE DATABASE IF NOT EXISTS ${sql.id("pr_undated_cleanup_test")}`.execute(rootDb);
    created.push("pr_undated_cleanup_test");

    const response = await cleanupHandler(scheduledRequest({ next_run: "2026-01-01T00:00:00Z" }));

    const body = await response.json();
    expect(body).toMatchObject({ count: 0, deleted: [] });
  });

  it("reports success with nothing deleted when no database is stale", async () => {
    const response = await cleanupHandler(scheduledRequest({ next_run: "2026-01-01T00:00:00Z" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      count: 0,
      deleted: [],
      next_run: "2026-01-01T00:00:00Z",
    });
  });

  it("returns 500 when the scheduled payload is not the expected shape", async () => {
    const response = await cleanupHandler(scheduledRequest({ wrong: "shape" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  });
});

describe("DatabaseCleanupRepository.canDeleteDatabase", () => {
  it.each(["dev", "prod", "defaultdb", "postgres", "system"])("protects %s", (name) => {
    expect(DatabaseCleanupRepository.canDeleteDatabase(name)).toBe(false);
  });

  it("refuses names outside the pr_ / dev_ prefixes", () => {
    expect(DatabaseCleanupRepository.canDeleteDatabase("movie_club_test")).toBe(false);
  });

  it("allows preview and spawned databases", () => {
    expect(DatabaseCleanupRepository.canDeleteDatabase("pr_123")).toBe(true);
    expect(DatabaseCleanupRepository.canDeleteDatabase("dev_someone_feature")).toBe(true);
  });

  it("refuses to drop a protected database even when asked directly", async () => {
    await expect(DatabaseCleanupRepository.dropDatabase("prod")).rejects.toThrow(
      /Cannot delete protected database/,
    );
  });
});
