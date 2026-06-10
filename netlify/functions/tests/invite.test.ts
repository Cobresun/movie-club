/**
 * Tests for netlify/functions/club/invite.ts
 *
 * Covers: POST / (create invite token)
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";

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
    createClubInvite: vi.fn(),
    joinClubWithInvite: vi.fn(),
    getClubDetailsByInvite: vi.fn(),
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
    getByEmail: vi.fn(),
    removeClubMember: vi.fn(),
    addClubMemberByUserId: vi.fn(),
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

// ─── POST /invite ─────────────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/invite/", () => {
  it("returns 200 with invite token when created successfully", async () => {
    setupClub();
    vi.mocked(ClubRepository.createClubInvite).mockResolvedValue(
      "token-abc123",
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/invite/`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ token: string }>(response.body);
    expect(body.token).toBe("token-abc123");
    expect(ClubRepository.createClubInvite).toHaveBeenCalledWith(CLUB_ID);
  });

  it("returns 400 when creating invite throws an error", async () => {
    setupClub();
    vi.mocked(ClubRepository.createClubInvite).mockRejectedValue(
      new Error("DB error"),
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/invite/`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
    const body = parseBody<{ error: string }>(response.body);
    expect(body.error).toContain("Failed to create invite");
  });

  it("returns 404 when club slug is not found", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/unknown-club/invite/`,
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});
