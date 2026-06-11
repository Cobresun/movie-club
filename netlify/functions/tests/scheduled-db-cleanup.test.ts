/**
 * Tests for netlify/functions/scheduled-db-cleanup.ts
 *
 * DatabaseCleanupRepository is mocked. The handler receives a standard
 * Netlify scheduled-function Request with a JSON body.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mock: database (DatabaseCleanupRepository imports db + rootDb at load time)
vi.mock("../utils/database", () => ({
  db: {},
  pool: {},
  dialect: {},
  getDbUrl: vi.fn(),
}));

vi.mock("../repositories/DatabaseCleanupRepository", () => ({
  default: {
    cleanupOldDatabases: vi.fn(),
  },
  PROTECTED_DATABASES: ["dev", "prod", "defaultdb", "postgres", "system"],
}));

import DatabaseCleanupRepository from "../repositories/DatabaseCleanupRepository";
import handler from "../scheduled-db-cleanup";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return {
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── handler ──────────────────────────────────────────────────────────────────

describe("scheduled-db-cleanup handler", () => {
  it("returns 200 with cleanup results on success", async () => {
    vi.mocked(DatabaseCleanupRepository.cleanupOldDatabases).mockResolvedValue({
      count: 2,
      deleted: ["pr_123", "dev_old_feature"],
    });

    const req = makeRequest({ next_run: "2024-01-02T00:00:00Z" });
    const response = await handler(req);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      count: number;
      deleted: string[];
      next_run: string;
    };
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(body.deleted).toEqual(["pr_123", "dev_old_feature"]);
    expect(body.next_run).toBe("2024-01-02T00:00:00Z");
  });

  it("passes olderThanDays=7 to cleanupOldDatabases", async () => {
    vi.mocked(DatabaseCleanupRepository.cleanupOldDatabases).mockResolvedValue({
      count: 0,
      deleted: [],
    });

    const req = makeRequest({ next_run: "2024-01-02T00:00:00Z" });
    await handler(req);

    expect(DatabaseCleanupRepository.cleanupOldDatabases).toHaveBeenCalledWith(
      7,
    );
  });

  it("returns 200 with count=0 when no databases to clean up", async () => {
    vi.mocked(DatabaseCleanupRepository.cleanupOldDatabases).mockResolvedValue({
      count: 0,
      deleted: [],
    });

    const req = makeRequest({ next_run: "2024-01-02T00:00:00Z" });
    const response = await handler(req);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
  });

  it("returns 500 when payload schema is invalid", async () => {
    const req = makeRequest({ wrong_field: "value" });
    const response = await handler(req);

    expect(response.status).toBe(500);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });

  it("returns 500 when cleanupOldDatabases throws", async () => {
    vi.mocked(DatabaseCleanupRepository.cleanupOldDatabases).mockRejectedValue(
      new Error("Connection refused"),
    );

    const req = makeRequest({ next_run: "2024-01-02T00:00:00Z" });
    const response = await handler(req);

    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      success: boolean;
      error: string;
    };
    expect(body.success).toBe(false);
    expect(body.error).toContain("Connection refused");
  });
});
