/**
 * Tests for netlify/functions/club/list.ts
 *
 * Covers: GET / (lists), GET /reviews, GET /reviews-id, POST / (create),
 * PUT /reorder (lists), GET /:listId, PUT /:listId (rename), DELETE /:listId,
 * POST /:listId/items, DELETE /:listId/items/:workId, PUT /:listId/reorder,
 * PUT /:listId/items/:workId/added-date, POST /:listId/items/:workId/move
 *
 * System-list protections (rename/delete rejected) are also exercised.
 */
import { DeleteResult, InsertResult, UpdateResult } from "kysely";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { ClubType, WorkListSystemType } from "../../../lib/types/generated/db";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";

// ─── Mock: auth ──────────────────────────────────────────────────────────────
vi.mock("../utils/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
  loggedIn: vi.fn(async (req: Record<string, unknown>) => ({
    ...req,
    userId: "user-1",
  })),
  secured: vi.fn(async (req: Record<string, unknown>) => ({
    ...req,
    userId: "user-1",
  })),
}));

// ─── Mock: database ──────────────────────────────────────────────────────────
vi.mock("../utils/database", () => ({
  db: {},
  pool: {},
  dialect: {},
  getDbUrl: vi.fn(),
}));

// ─── Mock: repositories ──────────────────────────────────────────────────────
vi.mock("../repositories/ClubRepository", () => ({
  default: {
    getBySlug: vi.fn(),
    isUserInClub: vi.fn(),
  },
}));

vi.mock("../repositories/ListRepository", () => ({
  default: {
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

vi.mock("../repositories/ReviewRepository", () => ({
  default: {
    getReviewList: vi.fn(),
    insertReview: vi.fn(),
    getById: vi.fn(),
    updateScore: vi.fn(),
    getReviewsByWorkId: vi.fn(),
  },
}));

vi.mock("../repositories/UserRepository", () => ({
  default: {
    getMembersByClubId: vi.fn(),
  },
}));

vi.mock("../repositories/WorkRepository", () => ({
  default: {
    findByType: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    getNextWork: vi.fn(),
    setNextWork: vi.fn(),
    deleteNextWork: vi.fn(),
    getDiscussionContext: vi.fn(),
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

vi.mock("../repositories/SettingsRepository", () => ({
  default: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    createDefaultSettings: vi.fn(),
  },
}));

vi.mock("../repositories/AwardsRepository", () => ({
  default: { getByYear: vi.fn(), getYears: vi.fn() },
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
  default: { getSharedReviewData: vi.fn() },
}));

// Import the top-level club handler (which mounts listRouter via use())

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CLUB_SLUG = "my-club";
const CLUB_ID = "club-1";
const LIST_ID = "list-99";

const mockClub = {
  id: CLUB_ID,
  name: "My Club",
  slug: CLUB_SLUG,
  type: ClubType.movie,
  legacy_id: null,
  slug_updated_at: null,
};

function setupClub() {
  vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
  vi.mocked(ClubRepository.isUserInClub).mockResolvedValue(true);
}

/** A user list (system_type = null). */
const mockUserList = {
  id: LIST_ID,
  title: "Watch List",
  system_type: null,
  club_id: CLUB_ID,
  position: "0",
};

/** A system list (system_type = 'reviews'). */
const mockSystemList = {
  id: "sys-list-1",
  title: "Reviews",
  system_type: WorkListSystemType.reviews,
  club_id: CLUB_ID,
  position: "-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET / (list collection) ──────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/list/", () => {
  it("returns 200 with mapped list objects", async () => {
    setupClub();
    vi.mocked(ListRepository.getListsForClub).mockResolvedValue([
      { ...mockUserList, item_count: "3" },
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<
      Array<{ id: string; title: string; itemCount: number }>
    >(response.body);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(LIST_ID);
    expect(body[0].itemCount).toBe(3);
  });
});

// ─── GET /reviews ─────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/list/reviews", () => {
  it("returns 200 with review list data", async () => {
    setupClub();
    vi.mocked(ReviewRepository.getReviewList).mockResolvedValue([]);
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/reviews`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<unknown[]>(response.body);
    expect(Array.isArray(body)).toBe(true);
  });
});

// ─── GET /reviews-id ─────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/list/reviews-id", () => {
  it("returns 200 with reviews list ID", async () => {
    setupClub();
    vi.mocked(ListRepository.getReviewsListId).mockResolvedValue("sys-list-1");

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/reviews-id`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ id: string }>(response.body);
    expect(body.id).toBe("sys-list-1");
  });
});

// ─── POST / (create list) ─────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/list/", () => {
  it("returns 200 with created list when title is valid", async () => {
    setupClub();
    vi.mocked(ListRepository.createList).mockResolvedValue({
      id: "new-list-1",
      title: "My New List",
      system_type: null,
      club_id: CLUB_ID,
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/`,
      httpMethod: "POST",
      body: JSON.stringify({ title: "My New List" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ id: string; title: string }>(response.body);
    expect(body.id).toBe("new-list-1");
    expect(body.title).toBe("My New List");
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when title is empty", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/`,
      httpMethod: "POST",
      body: JSON.stringify({ title: "" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /reorder (lists) ─────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/list/reorder", () => {
  it("returns 200 when list order is updated", async () => {
    setupClub();
    vi.mocked(ListRepository.reorderLists).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/reorder`,
      httpMethod: "PUT",
      body: JSON.stringify({ listIds: ["list-1", "list-2"] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.reorderLists).toHaveBeenCalledWith(CLUB_ID, [
      "list-1",
      "list-2",
    ]);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/reorder`,
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when listIds array is empty", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/reorder`,
      httpMethod: "PUT",
      body: JSON.stringify({ listIds: [] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:listId ─────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/list/:listId", () => {
  it("returns 200 with list items", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.getListItems).mockResolvedValue([]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<unknown[]>(response.body);
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 404 when list does not belong to club", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/unknown-list`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});

// ─── PUT /:listId (rename) ────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/list/:listId", () => {
  it("returns 200 when user list is renamed", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.renameList).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}`,
      httpMethod: "PUT",
      body: JSON.stringify({ title: "Renamed List" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.renameList).toHaveBeenCalledWith(
      LIST_ID,
      "Renamed List",
    );
  });

  it("returns 400 when trying to rename a system list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockSystemList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/sys-list-1`,
      httpMethod: "PUT",
      body: JSON.stringify({ title: "Hack Reviews" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
    const body = parseBody<{ error: string }>(response.body);
    expect(body.error).toContain("Cannot rename a system list");
  });

  it("returns 400 when body is missing", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}`,
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:listId ─────────────────────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/list/:listId", () => {
  it("returns 200 when user list is deleted", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.deleteList).mockResolvedValue([
      new DeleteResult(0n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.deleteList).toHaveBeenCalledWith(LIST_ID);
  });

  it("returns 400 when trying to delete a system list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockSystemList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/sys-list-1`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
    const body = parseBody<{ error: string }>(response.body);
    expect(body.error).toContain("Cannot delete a system list");
  });
});

// ─── POST /:listId/items ──────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/list/:listId/items", () => {
  it("returns 200 when item is added to list (new work)", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(WorkRepository.findByType).mockResolvedValue(undefined);
    vi.mocked(WorkRepository.insert).mockResolvedValue({ id: "work-new" });
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(false);
    vi.mocked(ListRepository.insertItemInList).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items`,
      httpMethod: "POST",
      body: JSON.stringify({
        title: "The Matrix",
        type: "movie",
        externalId: "603",
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.insertItemInList).toHaveBeenCalledWith(
      LIST_ID,
      "work-new",
      "user-1",
    );
  });

  it("returns 200 when item already exists as work (reuses work id)", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(WorkRepository.findByType).mockResolvedValue({
      id: "work-existing",
    });
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(false);
    vi.mocked(ListRepository.insertItemInList).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items`,
      httpMethod: "POST",
      body: JSON.stringify({
        title: "The Matrix",
        type: "movie",
        externalId: "603",
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkRepository.insert).not.toHaveBeenCalled();
    expect(ListRepository.insertItemInList).toHaveBeenCalledWith(
      LIST_ID,
      "work-existing",
      "user-1",
    );
  });

  it("returns 400 when item is already in list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(WorkRepository.findByType).mockResolvedValue({ id: "work-dup" });
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(true);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items`,
      httpMethod: "POST",
      body: JSON.stringify({
        title: "The Matrix",
        type: "movie",
        externalId: "603",
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:listId/items/:workId ────────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/list/:listId/items/:workId", () => {
  it("returns 200 when item is removed from list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(true);
    vi.mocked(ListRepository.deleteItemFromList).mockResolvedValue([
      new DeleteResult(0n),
    ]);
    vi.mocked(WorkRepository.delete).mockResolvedValue([new DeleteResult(0n)]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.deleteItemFromList).toHaveBeenCalledWith(
      LIST_ID,
      "work-123",
    );
  });

  it("returns 400 when item is not in list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(false);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-999`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:listId/reorder ─────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/list/:listId/reorder", () => {
  it("returns 200 when items are reordered", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.reorderList).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/reorder`,
      httpMethod: "PUT",
      body: JSON.stringify({ workIds: ["work-a", "work-b"] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.reorderList).toHaveBeenCalledWith(LIST_ID, [
      "work-a",
      "work-b",
    ]);
  });

  it("returns 400 when workIds is empty", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/reorder`,
      httpMethod: "PUT",
      body: JSON.stringify({ workIds: [] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:listId/items/:workId/added-date ────────────────────────────────────

describe("PUT /api/club/:clubSlug/list/:listId/items/:workId/added-date", () => {
  it("returns 200 when added date is updated", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(true);
    vi.mocked(ListRepository.updateAddedDate).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123/added-date`,
      httpMethod: "PUT",
      body: JSON.stringify({ addedDate: "2024-01-15T00:00:00Z" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.updateAddedDate).toHaveBeenCalledWith(
      LIST_ID,
      "work-123",
      new Date("2024-01-15T00:00:00Z"),
    );
  });

  it("returns 400 when date is not a valid ISO datetime", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123/added-date`,
      httpMethod: "PUT",
      body: JSON.stringify({ addedDate: "not-a-date" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when work is not in list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(false);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-999/added-date`,
      httpMethod: "PUT",
      body: JSON.stringify({ addedDate: "2024-01-15T00:00:00Z" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /:listId/items/:workId/move ─────────────────────────────────────────

describe("POST /api/club/:clubSlug/list/:listId/items/:workId/move", () => {
  it("returns 200 when item is moved to destination list", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById)
      .mockResolvedValueOnce(mockUserList) // validListId for source
      .mockResolvedValueOnce({ ...mockUserList, id: "dest-list-2" }); // destination lookup
    vi.mocked(ListRepository.moveItem).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123/move`,
      httpMethod: "POST",
      body: JSON.stringify({ destinationListId: "dest-list-2" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ListRepository.moveItem).toHaveBeenCalledWith(
      LIST_ID,
      "dest-list-2",
      "work-123",
    );
  });

  it("returns 400 when destination list is not found", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById)
      .mockResolvedValueOnce(mockUserList) // validListId for source
      .mockResolvedValueOnce(undefined); // destination not found

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123/move`,
      httpMethod: "POST",
      body: JSON.stringify({ destinationListId: "non-existent" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();
    vi.mocked(ListRepository.getListById).mockResolvedValue(mockUserList);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/list/${LIST_ID}/items/work-123/move`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});
