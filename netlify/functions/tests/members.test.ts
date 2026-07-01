/**
 * Tests for netlify/functions/club/members.ts and club/members/join.ts
 *
 * Covers: GET / (list members), DELETE /self, DELETE /:memberId,
 * POST /join (join via invite), GET /joinInfo/:token
 */
import { DeleteResult } from "kysely";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { ClubType } from "../../../lib/types/generated/db";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";
import UserRepository from "../repositories/UserRepository";

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
    joinClubWithInvite: vi.fn(),
    getClubDetailsByInvite: vi.fn(),
    createClubInvite: vi.fn(),
  },
}));

vi.mock("../repositories/UserRepository", () => ({
  default: {
    getMembersByClubId: vi.fn(),
    removeClubMember: vi.fn(),
    addClubMemberByUserId: vi.fn(),
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
  type: ClubType.movie,
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

// ─── GET /members ─────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/members/", () => {
  it("returns 200 with mapped member list", async () => {
    setupClub();
    vi.mocked(UserRepository.getMembersByClubId).mockResolvedValue([
      {
        id: "user-1",
        email: "alice@example.com",
        name: "Alice",
        image: null,
        role: "admin",
      },
      {
        id: "user-2",
        email: "bob@example.com",
        name: "Bob",
        image: "https://example.com/bob.jpg",
        role: "member",
      },
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/members/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<
      Array<{
        id: string;
        email: string;
        name: string;
        image?: string | null;
        role?: string;
      }>
    >(response.body);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("user-1");
    expect(body[0].role).toBe("admin");
    expect(body[1].image).toBe("https://example.com/bob.jpg");
  });

  it("returns 404 when club slug is unknown", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/unknown-club/members/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /members/self ─────────────────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/members/self", () => {
  it("returns 200 when authenticated user leaves club", async () => {
    setupClub();
    vi.mocked(UserRepository.removeClubMember).mockResolvedValue([
      new DeleteResult(0n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/members/self`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(UserRepository.removeClubMember).toHaveBeenCalledWith(
      CLUB_ID,
      "user-1",
    );
  });

  it("returns 401 when user is not authenticated", async () => {
    setupClub();
    const { secured } = await import("../utils/auth");
    vi.mocked(secured).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/members/self`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});

// ─── DELETE /members/:memberId ────────────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/members/:memberId", () => {
  it("returns 200 when member is removed", async () => {
    setupClub();
    vi.mocked(UserRepository.removeClubMember).mockResolvedValue([
      new DeleteResult(0n),
    ]);

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/members/user-2`,
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(UserRepository.removeClubMember).toHaveBeenCalledWith(
      CLUB_ID,
      "user-2",
    );
  });
});

// ─── POST /join ───────────────────────────────────────────────────────────────

describe("POST /api/club/join", () => {
  it("returns 200 when user successfully joins via valid invite token", async () => {
    vi.mocked(ClubRepository.joinClubWithInvite).mockResolvedValue({
      success: true,
    });

    const event = makeEvent({
      path: `/api/club/join`,
      httpMethod: "POST",
      body: JSON.stringify({ token: "abc123token" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ClubRepository.joinClubWithInvite).toHaveBeenCalledWith(
      "abc123token",
      "user-1",
    );
  });

  it("returns 400 when invite token is invalid", async () => {
    vi.mocked(ClubRepository.joinClubWithInvite).mockResolvedValue({
      success: false,
      error: "Invalid invite token",
    });

    const event = makeEvent({
      path: `/api/club/join`,
      httpMethod: "POST",
      body: JSON.stringify({ token: "bad-token" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    const event = makeEvent({
      path: `/api/club/join`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when token field is missing from body", async () => {
    const event = makeEvent({
      path: `/api/club/join`,
      httpMethod: "POST",
      body: JSON.stringify({ notAToken: "xyz" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /joinInfo/:token ─────────────────────────────────────────────────────

describe("GET /api/club/joinInfo/:token", () => {
  it("returns 200 with club details when token is valid and not expired", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    vi.mocked(ClubRepository.getClubDetailsByInvite).mockResolvedValue({
      clubId: CLUB_ID,
      clubName: "My Club",
      expiresAt: futureDate,
    });

    const event = makeEvent({
      path: `/api/club/joinInfo/valid-token`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ clubId: string; clubName: string }>(response.body);
    expect(body.clubId).toBe(CLUB_ID);
    expect(body.clubName).toBe("My Club");
  });

  it("returns 400 when invite token has expired", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    vi.mocked(ClubRepository.getClubDetailsByInvite).mockResolvedValue({
      clubId: CLUB_ID,
      clubName: "My Club",
      expiresAt: pastDate,
    });

    const event = makeEvent({
      path: `/api/club/joinInfo/expired-token`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when invite token is not found", async () => {
    vi.mocked(ClubRepository.getClubDetailsByInvite).mockResolvedValue(
      undefined,
    );

    const event = makeEvent({
      path: `/api/club/joinInfo/unknown-token`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});
