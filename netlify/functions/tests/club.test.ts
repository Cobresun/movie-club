/**
 * Tests for netlify/functions/club/index.ts
 *
 * Covers: GET /:clubSlug, POST /, PUT /:clubSlug/name, PUT /:clubSlug/slug,
 * GET|PUT|DELETE /:clubSlug/nextWork, and 404/405 routing.
 *
 * Auth (loggedIn / secured) and validClubSlug middleware are mocked so that
 * we can exercise the handlers in isolation.
 */
import { DeleteResult, InsertResult, UpdateResult } from "kysely";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import SettingsRepository from "../repositories/SettingsRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";

// ─── Mock: auth ────────────────────────────────────────────────────────────
// auth.ts instantiates BetterAuth at import time; mock the whole module so no
// env-var assertions fire.  loggedIn / secured are replaced with pass-through
// stubs that inject a userId so downstream handlers see an authenticated user.

vi.mock("../utils/auth", () => {
  return {
    auth: { api: { getSession: vi.fn() } },
    loggedIn: vi.fn(async (req: Record<string, unknown>) => ({
      ...req,
      userId: "user-1",
    })),
    secured: vi.fn(async (req: Record<string, unknown>) => ({
      ...req,
      userId: "user-1",
    })),
  };
});

// ─── Mock: database ─────────────────────────────────────────────────────────
// club/index.ts calls db.insertInto("club_member").values(...).execute() directly,
// so we need a fluent query-builder stub.
const mockExecute = vi.fn().mockResolvedValue([]);
const mockQueryBuilder = {
  values: vi.fn().mockReturnThis(),
  execute: mockExecute,
};

vi.mock("../utils/database", () => ({
  db: {
    insertInto: vi.fn(() => mockQueryBuilder),
  },
  pool: {},
  dialect: {},
  getDbUrl: vi.fn(),
}));

// ─── Mock: repositories ─────────────────────────────────────────────────────
vi.mock("../repositories/ClubRepository", () => ({
  default: {
    getBySlug: vi.fn(),
    getById: vi.fn(),
    insert: vi.fn(),
    updateName: vi.fn(),
    updateSlug: vi.fn(),
    slugExists: vi.fn(),
    isUserInClub: vi.fn(),
    getClubPreviewsByUserId: vi.fn(),
    createClubInvite: vi.fn(),
    joinClubWithInvite: vi.fn(),
    getClubDetailsByInvite: vi.fn(),
  },
}));
vi.mock("../repositories/ListRepository", () => ({
  default: {
    createListsForClub: vi.fn(),
    getListsForClub: vi.fn(),
    getReviewsListId: vi.fn(),
    getListById: vi.fn(),
    isItemInList: vi.fn(),
    insertItemInList: vi.fn(),
    deleteItemFromList: vi.fn(),
    renameList: vi.fn(),
    deleteList: vi.fn(),
    createList: vi.fn(),
    getListItems: vi.fn(),
    reorderList: vi.fn(),
    reorderLists: vi.fn(),
    updateAddedDate: vi.fn(),
    moveItem: vi.fn(),
    getWorkDetails: vi.fn(),
  },
}));
vi.mock("../repositories/SettingsRepository", () => ({
  default: {
    createDefaultSettings: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));
vi.mock("../repositories/UserRepository", () => ({
  default: {
    getByEmail: vi.fn(),
    getMembersByClubId: vi.fn(),
    getUserById: vi.fn(),
    removeClubMember: vi.fn(),
    addClubMemberByUserId: vi.fn(),
    updateImage: vi.fn(),
    updateName: vi.fn(),
  },
}));
vi.mock("../repositories/WorkRepository", () => ({
  default: {
    getNextWork: vi.fn(),
    setNextWork: vi.fn(),
    deleteNextWork: vi.fn(),
    findByType: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    getDiscussionContext: vi.fn(),
  },
}));
vi.mock("../repositories/ReviewRepository", () => ({
  default: {
    getReviewList: vi.fn(),
    insertReview: vi.fn(),
    getById: vi.fn(),
    updateScore: vi.fn(),
    getReviewsByWorkId: vi.fn(),
  },
}));
vi.mock("../repositories/WorkCommentRepository", () => ({
  default: {
    getByWorkAndClub: vi.fn(),
    insert: vi.fn(),
    getById: vi.fn(),
    updateContent: vi.fn(),
    deleteById: vi.fn(),
  },
}));
vi.mock("../repositories/AwardsRepository", () => ({
  default: {
    getByYear: vi.fn(),
    getYears: vi.fn(),
  },
}));

vi.mock("../utils/tmdb", () => ({
  getDetailedMovie: vi.fn(),
  getDetailedWorks: vi.fn(),
  getTMDBMovieData: vi.fn(),
}));

vi.mock("../utils/gemini", () => ({
  generateDiscussionQuestions: vi.fn(),
}));

vi.mock("../services/SharedReviewService", () => ({
  default: {
    getSharedReviewData: vi.fn(),
  },
}));

// Import the mocked modules for assertions

// Import handler AFTER all mocks are set up

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const mockClub = {
  id: "club-1",
  name: "Test Club",
  slug: "test-club",
  legacy_id: null,
  slug_updated_at: null,
};

function setupClub() {
  vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
  vi.mocked(ClubRepository.getById).mockResolvedValue(mockClub);
  vi.mocked(ClubRepository.isUserInClub).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /:clubSlug ──────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug", () => {
  it("returns 200 with club preview when club exists", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ clubId: string; clubName: string; slug: string }>(
      response.body,
    );
    expect(body.clubId).toBe("club-1");
    expect(body.clubName).toBe("Test Club");
    expect(body.slug).toBe("test-club");
  });

  it("returns 404 when club slug is not found", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/unknown-club",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / (create club) ────────────────────────────────────────────────────

describe("POST /api/club/", () => {
  it("returns 200 with clubId and slug when club is created successfully", async () => {
    vi.mocked(ClubRepository.insert).mockResolvedValue({
      id: "new-club-1",
      slug: "new-club",
    });
    vi.mocked(ListRepository.createListsForClub).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);
    vi.mocked(SettingsRepository.createDefaultSettings).mockResolvedValue(
      undefined,
    );
    vi.mocked(UserRepository.getByEmail).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      image: null,
      image_id: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    });

    const event = makeEvent({
      path: "/api/club/",
      httpMethod: "POST",
      body: JSON.stringify({ name: "New Club", members: ["user@example.com"] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ clubId: string; slug: string }>(response.body);
    expect(body.clubId).toBe("new-club-1");
    expect(body.slug).toBe("new-club");
  });

  it("returns 400 when body is missing", async () => {
    const event = makeEvent({
      path: "/api/club/",
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is invalid JSON schema", async () => {
    const event = makeEvent({
      path: "/api/club/",
      httpMethod: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 401 when user is not authenticated", async () => {
    // Override loggedIn to return 401 for this test
    const { loggedIn } = await import("../utils/auth");
    vi.mocked(loggedIn).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: "/api/club/",
      httpMethod: "POST",
      body: JSON.stringify({ name: "Club", members: [] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 when ClubRepository.insert returns undefined", async () => {
    vi.mocked(ClubRepository.insert).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/",
      httpMethod: "POST",
      body: JSON.stringify({ name: "New Club", members: [] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:clubSlug/name ─────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/name", () => {
  it("returns 200 when name is updated successfully", async () => {
    setupClub();
    vi.mocked(ClubRepository.updateName).mockResolvedValue(
      new UpdateResult(0n, undefined),
    );

    const event = makeEvent({
      path: "/api/club/test-club/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "Updated Club Name" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ClubRepository.updateName).toHaveBeenCalledWith(
      "club-1",
      "Updated Club Name",
    );
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club/name",
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when name fails schema validation", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 401 when user is not authenticated", async () => {
    setupClub();
    const { secured } = await import("../utils/auth");
    vi.mocked(secured).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: "/api/club/test-club/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "Name" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});

// ─── PUT /:clubSlug/slug ─────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/slug", () => {
  it("returns 200 with new slug when slug is updated successfully", async () => {
    setupClub();
    vi.mocked(ClubRepository.slugExists).mockResolvedValue(false);
    vi.mocked(ClubRepository.updateSlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/test-club/slug",
      httpMethod: "PUT",
      body: JSON.stringify({ slug: "new-slug" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ slug: string }>(response.body);
    expect(body.slug).toBe("new-slug");
  });

  it("returns 400 when slug is already taken by another club", async () => {
    setupClub();
    vi.mocked(ClubRepository.slugExists).mockResolvedValue(true);

    const event = makeEvent({
      path: "/api/club/test-club/slug",
      httpMethod: "PUT",
      body: JSON.stringify({ slug: "taken-slug" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club/slug",
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when slug contains invalid characters", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club/slug",
      httpMethod: "PUT",
      body: JSON.stringify({ slug: "INVALID SLUG WITH SPACES!" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:clubSlug/nextWork ──────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/nextWork", () => {
  it("returns 200 with workId when next work exists", async () => {
    setupClub();
    vi.mocked(WorkRepository.getNextWork).mockResolvedValue({
      work_id: "work-123",
    });

    const event = makeEvent({
      path: "/api/club/test-club/nextWork",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ workId: string }>(response.body);
    expect(body.workId).toBe("work-123");
  });

  it("returns 200 with undefined workId when no next work", async () => {
    setupClub();
    vi.mocked(WorkRepository.getNextWork).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/test-club/nextWork",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ workId: undefined }>(response.body);
    expect(body.workId).toBeUndefined();
  });
});

// ─── PUT /:clubSlug/nextWork ──────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/nextWork", () => {
  it("returns 200 when next work is set", async () => {
    setupClub();
    vi.mocked(WorkRepository.deleteNextWork).mockResolvedValue([
      new DeleteResult(0n),
    ]);
    vi.mocked(WorkRepository.setNextWork).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);

    const event = makeEvent({
      path: "/api/club/test-club/nextWork",
      httpMethod: "PUT",
      body: JSON.stringify({ workId: "work-456" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkRepository.deleteNextWork).toHaveBeenCalledWith("club-1");
    expect(WorkRepository.setNextWork).toHaveBeenCalledWith(
      "club-1",
      "work-456",
    );
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club/nextWork",
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:clubSlug/nextWork ───────────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/nextWork", () => {
  it("returns 200 when next work is deleted", async () => {
    setupClub();
    vi.mocked(WorkRepository.deleteNextWork).mockResolvedValue([
      new DeleteResult(0n),
    ]);

    const event = makeEvent({
      path: "/api/club/test-club/nextWork",
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkRepository.deleteNextWork).toHaveBeenCalledWith("club-1");
  });
});

// ─── 404 / 405 routing ───────────────────────────────────────────────────────

describe("routing: unknown paths and wrong methods", () => {
  it("returns 404 for an unknown path", async () => {
    const event = makeEvent({
      path: "/api/club/non-existent-path/something",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    // validClubSlug will 404 on an unknown slug
    expect(response.statusCode).toBe(404);
  });

  it("returns 405 for wrong HTTP method on known route", async () => {
    setupClub();

    const event = makeEvent({
      path: "/api/club/test-club",
      httpMethod: "POST",
    });

    // GET /:clubSlug exists; POST does not
    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(405);
  });
});
