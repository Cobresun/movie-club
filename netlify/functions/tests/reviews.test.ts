/**
 * Tests for netlify/functions/club/reviews.ts
 *
 * Covers: POST / (add review), PUT /:reviewId (update review),
 * GET /:workId/comments, POST /:workId/comments,
 * PUT /:workId/comments/:commentId, DELETE /:workId/comments/:commentId,
 * GET /:workId/shared, POST /:workId/discussion-questions
 *
 * Comment ownership enforcement (401 when non-author edits/deletes) is tested.
 */
import { DeleteResult, InsertResult, UpdateResult } from "kysely";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { WorkType } from "../../../lib/types/generated/db";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import SettingsRepository from "../repositories/SettingsRepository";
import WorkCommentRepository from "../repositories/WorkCommentRepository";
import WorkRepository from "../repositories/WorkRepository";
import SharedReviewService from "../services/SharedReviewService";
import { generateDiscussionQuestions } from "../utils/gemini";

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
    getReviewsListId: vi.fn(),
    isItemInList: vi.fn(),
    getListById: vi.fn(),
    getListsForClub: vi.fn(),
    createList: vi.fn(),
    renameList: vi.fn(),
    deleteList: vi.fn(),
    getListItems: vi.fn(),
    reorderList: vi.fn(),
    reorderLists: vi.fn(),
    updateAddedDate: vi.fn(),
    moveItem: vi.fn(),
    getWorkDetails: vi.fn(),
    insertItemInList: vi.fn(),
    deleteItemFromList: vi.fn(),
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

vi.mock("../repositories/SettingsRepository", () => ({
  default: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    createDefaultSettings: vi.fn(),
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

vi.mock("../repositories/UserRepository", () => ({
  default: {
    getMembersByClubId: vi.fn(),
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

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CLUB_SLUG = "my-club";
const CLUB_ID = "club-1";

const mockClub = {
  id: CLUB_ID,
  name: "My Club",
  slug: CLUB_SLUG,
  legacy_id: null,
  slug_updated_at: null,
};

function setupClub() {
  vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
  vi.mocked(ClubRepository.isUserInClub).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST / (add review) ─────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/reviews/", () => {
  it("returns 200 when review is inserted successfully", async () => {
    setupClub();
    vi.mocked(ListRepository.getReviewsListId).mockResolvedValue("sys-list-1");
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(true);
    vi.mocked(ReviewRepository.insertReview).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/`,
      httpMethod: "POST",
      body: JSON.stringify({ score: 8.5, workId: "work-123" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ReviewRepository.insertReview).toHaveBeenCalledWith(
      CLUB_ID,
      "work-123",
      "user-1",
      8.5,
    );
  });

  it("returns 400 when movie is not in the reviews list", async () => {
    setupClub();
    vi.mocked(ListRepository.getReviewsListId).mockResolvedValue("sys-list-1");
    vi.mocked(ListRepository.isItemInList).mockResolvedValue(false);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/`,
      httpMethod: "POST",
      body: JSON.stringify({ score: 7, workId: "work-999" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when score is out of range", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/`,
      httpMethod: "POST",
      body: JSON.stringify({ score: 11, workId: "work-123" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/`,
      httpMethod: "POST",
      body: null,
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
      path: `/api/club/${CLUB_SLUG}/reviews/`,
      httpMethod: "POST",
      body: JSON.stringify({ score: 8, workId: "work-123" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});

// ─── PUT /:reviewId (update review) ──────────────────────────────────────────

describe("PUT /api/club/:clubSlug/reviews/:reviewId", () => {
  it("returns 200 when review score is updated by the owner", async () => {
    setupClub();
    vi.mocked(ReviewRepository.getById).mockResolvedValue({
      id: "review-1",
      user_id: "user-1",
      score: "7",
      work_id: "work-123",
      list_id: "sys-list-1",
      created_date: new Date(),
    });
    vi.mocked(ReviewRepository.updateScore).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/review-1`,
      httpMethod: "PUT",
      body: JSON.stringify({ score: 9 }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ReviewRepository.updateScore).toHaveBeenCalledWith("review-1", 9);
  });

  it("returns 400 when user is not the review owner", async () => {
    setupClub();
    vi.mocked(ReviewRepository.getById).mockResolvedValue({
      id: "review-1",
      user_id: "other-user",
      score: "7",
      work_id: "work-123",
      list_id: "sys-list-1",
      created_date: new Date(),
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/review-1`,
      httpMethod: "PUT",
      body: JSON.stringify({ score: 9 }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/review-1`,
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:workId/comments ────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/reviews/:workId/comments", () => {
  it("returns 200 with comments array", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getByWorkAndClub).mockResolvedValue([
      {
        id: "comment-1",
        workId: "work-123",
        userId: "user-1",
        userName: "Alice",
        userImage: undefined,
        content: "Great film!",
        createdDate: new Date().toISOString(),
        spoiler: false,
      },
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<unknown[]>(response.body);
    expect(body).toHaveLength(1);
  });
});

// ─── POST /:workId/comments ───────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/reviews/:workId/comments", () => {
  it("returns 200 when comment is added", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.insert).mockResolvedValue([
      new InsertResult(undefined, 1n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments`,
      httpMethod: "POST",
      body: JSON.stringify({ content: "Amazing movie!", spoiler: false }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkCommentRepository.insert).toHaveBeenCalledWith(
      "work-123",
      CLUB_ID,
      "user-1",
      "Amazing movie!",
      false,
    );
  });

  it("returns 400 when content is empty", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments`,
      httpMethod: "POST",
      body: JSON.stringify({ content: "" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:workId/comments/:commentId ─────────────────────────────────────────

describe("PUT /api/club/:clubSlug/reviews/:workId/comments/:commentId", () => {
  it("returns 200 when comment is updated by the author", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue({
      id: "comment-1",
      user_id: "user-1",
    });
    vi.mocked(WorkCommentRepository.updateContent).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/comment-1`,
      httpMethod: "PUT",
      body: JSON.stringify({ content: "Edited comment", spoiler: true }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkCommentRepository.updateContent).toHaveBeenCalledWith(
      "comment-1",
      "user-1",
      "Edited comment",
      true,
    );
  });

  it("returns 401 when user is not the comment author", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue({
      id: "comment-1",
      user_id: "other-user",
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/comment-1`,
      httpMethod: "PUT",
      body: JSON.stringify({ content: "Malicious edit" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 when comment is not found", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/missing`,
      httpMethod: "PUT",
      body: JSON.stringify({ content: "hello" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/comment-1`,
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:workId/comments/:commentId ──────────────────────────────────────

describe("DELETE /api/club/:clubSlug/reviews/:workId/comments/:commentId", () => {
  it("returns 200 when comment is deleted by the author", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue({
      id: "comment-1",
      user_id: "user-1",
    });
    vi.mocked(WorkCommentRepository.deleteById).mockResolvedValue([
      new DeleteResult(0n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/comment-1`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(WorkCommentRepository.deleteById).toHaveBeenCalledWith("comment-1");
  });

  it("returns 401 when user is not the comment author", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue({
      id: "comment-1",
      user_id: "other-user",
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/comment-1`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 when comment does not exist", async () => {
    setupClub();
    vi.mocked(WorkCommentRepository.getById).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/comments/gone`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:workId/shared ──────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/reviews/:workId/shared", () => {
  it("returns 200 with shared review data when work exists", async () => {
    setupClub();
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue({
      reviews: [],
      members: [],
      comments: [],
      work: {
        id: "work-123",
        title: "Inception",
        type: WorkType.movie,
        imageUrl: undefined,
        externalId: "27205",
        externalData: undefined,
      },
      clubName: "My Club",
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/shared`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ clubName: string }>(response.body);
    expect(body.clubName).toBe("My Club");
  });

  it("returns 400 when work is not found", async () => {
    setupClub();
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue(null);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/missing-work/shared`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /:workId/discussion-questions ───────────────────────────────────────

describe("POST /api/club/:clubSlug/reviews/:workId/discussion-questions", () => {
  it("returns 200 with questions when feature is enabled", async () => {
    setupClub();
    vi.mocked(SettingsRepository.getSettings).mockResolvedValue({
      features: { blurScores: false, awards: false, discussionQuestions: true },
    });
    vi.mocked(WorkRepository.getDiscussionContext).mockResolvedValue({
      title: "Inception",
      release_date: new Date("2010-07-16"),
    });
    vi.mocked(generateDiscussionQuestions).mockResolvedValue([
      "What did the ending mean?",
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/discussion-questions`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ questions: string[] }>(response.body);
    expect(body.questions).toContain("What did the ending mean?");
  });

  it("returns 400 when discussion questions feature is disabled", async () => {
    setupClub();
    vi.mocked(SettingsRepository.getSettings).mockResolvedValue({
      features: {
        blurScores: false,
        awards: false,
        discussionQuestions: false,
      },
    });

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-123/discussion-questions`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when work is not found", async () => {
    setupClub();
    vi.mocked(SettingsRepository.getSettings).mockResolvedValue({
      features: { blurScores: false, awards: false, discussionQuestions: true },
    });
    vi.mocked(WorkRepository.getDiscussionContext).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/reviews/work-999/discussion-questions`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});
