/**
 * Tests for netlify/functions/club/settings.ts
 *
 * Covers: GET / (get settings), POST / (update settings)
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { handler } from "../club/index";
import ClubRepository from "../repositories/ClubRepository";
import SettingsRepository from "../repositories/SettingsRepository";

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

vi.mock("../repositories/SettingsRepository", () => ({
  default: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    createDefaultSettings: vi.fn(),
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

const defaultSettings = {
  features: { blurScores: true, awards: false, discussionQuestions: false },
};

function setupClub() {
  vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
  vi.mocked(ClubRepository.isUserInClub).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /settings ────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/settings/", () => {
  it("returns 200 with current settings", async () => {
    setupClub();
    vi.mocked(SettingsRepository.getSettings).mockResolvedValue(
      defaultSettings,
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<typeof defaultSettings>(response.body);
    expect(body.features.blurScores).toBe(true);
    expect(body.features.awards).toBe(false);
  });

  it("returns 401 when user is not authenticated", async () => {
    setupClub();
    const { secured } = await import("../utils/auth");
    vi.mocked(secured).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });

  it("returns 404 when club slug is unknown", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: `/api/club/unknown-club/settings/`,
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /settings ───────────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/settings/", () => {
  it("returns 200 with updated settings when awards feature is enabled", async () => {
    setupClub();
    const updatedSettings = {
      features: { blurScores: true, awards: true, discussionQuestions: false },
    };
    vi.mocked(SettingsRepository.updateSettings).mockResolvedValue(
      updatedSettings,
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "POST",
      body: JSON.stringify({ features: { awards: true } }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<typeof updatedSettings>(response.body);
    expect(body.features.awards).toBe(true);
  });

  it("returns 200 when body is an empty object (no-op update)", async () => {
    setupClub();
    vi.mocked(SettingsRepository.updateSettings).mockResolvedValue(
      defaultSettings,
    );

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "POST",
      body: JSON.stringify({}),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
  });

  it("returns 400 when body is missing", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when features contains invalid field types", async () => {
    setupClub();

    const event = makeEvent({
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "POST",
      // blurScores must be boolean, not string
      body: JSON.stringify({ features: { blurScores: "yes" } }),
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
      path: `/api/club/${CLUB_SLUG}/settings/`,
      httpMethod: "POST",
      body: JSON.stringify({ features: { awards: true } }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});
