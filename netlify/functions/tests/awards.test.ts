/**
 * Tests for netlify/functions/club/awards/ handlers
 *
 * Covers:
 *   - GET  /:clubSlug/awards/years
 *   - GET  /:clubSlug/awards/:year
 *   - POST /:clubSlug/awards/:year/category
 *   - PUT  /:clubSlug/awards/:year/category
 *   - DELETE /:clubSlug/awards/:year/category/:awardTitle
 *   - POST /:clubSlug/awards/:year/nomination
 *   - DELETE /:clubSlug/awards/:year/nomination/:movieId
 *   - POST /:clubSlug/awards/:year/ranking
 *   - PUT  /:clubSlug/awards/:year/step
 *
 * validYear middleware (existsByYear) and validClubSlug are mocked so handlers
 * run in isolation.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { AwardsData, AwardsStep } from "../../../lib/types/awards";
import { ClubType } from "../../../lib/types/generated/db";
import { handler } from "../club/index";
import AwardsRepository from "../repositories/AwardsRepository";
import ClubRepository from "../repositories/ClubRepository";
import { getDetailedMovie } from "../utils/tmdb";

// ─── Mock: auth ─────────────────────────────────────────────────────────────
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
    getById: vi.fn(),
    isUserInClub: vi.fn(),
    insert: vi.fn(),
    updateName: vi.fn(),
    updateSlug: vi.fn(),
    slugExists: vi.fn(),
    getClubPreviewsByUserId: vi.fn(),
    createClubInvite: vi.fn(),
    joinClubWithInvite: vi.fn(),
    getClubDetailsByInvite: vi.fn(),
  },
}));

vi.mock("../repositories/AwardsRepository", () => ({
  default: {
    getByYear: vi.fn(),
    getYears: vi.fn(),
    existsByYear: vi.fn(),
    updateByYear: vi.fn(),
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

// ─── Import mocked modules for assertions ────────────────────────────────────

// ─── Shared fixtures ─────────────────────────────────────────────────────────

// The awards sub-router path patterns (:clubId<\\d+>, :year<\\d+>) require all
// digits. Since the club/index handler uses /:clubSlug/awards and the path
// ultimately gets tested against the full URL, we use a numeric slug so the
// digit constraint on the nested sub-routers is satisfied. Using "1" as both
// slug and id means event.path of "/api/club/1/awards/..." passes all checks.
const mockClub = {
  id: "1",
  name: "Test Club",
  slug: "1",
  type: ClubType.movie,
  legacy_id: null,
  slug_updated_at: null,
};

const baseAwardsData: AwardsData = {
  step: AwardsStep.Nominations,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 27205,
          nominatedBy: ["user-1"],
          ranking: {},
        },
      ],
    },
    {
      title: "Best Director",
      nominations: [],
    },
  ],
};

function setupClubAndYear() {
  vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
  vi.mocked(AwardsRepository.existsByYear).mockResolvedValue(true);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /years ───────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/awards/years", () => {
  it("returns 200 with years array", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(AwardsRepository.getYears).mockResolvedValue([2024, 2023, 2022]);

    const event = makeEvent({
      path: "/api/club/1/awards/years",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<number[]>(response.body);
    expect(body).toEqual([2024, 2023, 2022]);
  });

  it("returns 200 with empty array when no years exist", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(AwardsRepository.getYears).mockResolvedValue([]);

    const event = makeEvent({
      path: "/api/club/1/awards/years",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<number[]>(response.body);
    expect(body).toEqual([]);
  });
});

// ─── GET /:year ───────────────────────────────────────────────────────────────

describe("GET /api/club/:clubSlug/awards/:year", () => {
  it("returns 200 with awards data when year exists", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.getByYear).mockResolvedValue(baseAwardsData);
    vi.mocked(getDetailedMovie).mockResolvedValue([]);

    const event = makeEvent({
      path: "/api/club/1/awards/2024",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<{ year: number; step: number }>(response.body);
    expect(body.year).toBe(2024);
    expect(body.step).toBe(AwardsStep.Nominations);
  });

  it("returns 404 when year does not exist in awards repository", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(AwardsRepository.existsByYear).mockResolvedValue(true);
    vi.mocked(AwardsRepository.getByYear).mockResolvedValue(null);

    const event = makeEvent({
      path: "/api/club/1/awards/2024",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when validYear finds no row in existsByYear", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(AwardsRepository.existsByYear).mockResolvedValue(false);

    const event = makeEvent({
      path: "/api/club/1/awards/2024",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });

  it("returns 404 when club is not found", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/unknown-club/awards/2024",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /:year/category ─────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/awards/:year/category", () => {
  it("returns 200 when category is added successfully", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "POST",
      body: JSON.stringify({ title: "Best Screenplay" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(AwardsRepository.updateByYear).toHaveBeenCalledWith(
      "1",
      2024,
      expect.any(Function),
    );
  });

  it("returns 400 when body is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body schema is invalid", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "POST",
      body: JSON.stringify({ invalid: "data" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:year/category ──────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/awards/:year/category", () => {
  it("returns 200 when categories are reordered successfully", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "PUT",
      body: JSON.stringify({ categories: ["Best Director", "Best Picture"] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
  });

  it("returns 400 when body is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body schema is invalid (categories must be string array)", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "PUT",
      body: JSON.stringify({ categories: [1, 2] }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 500 when updateByYear throws (mismatched category)", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        updater(baseAwardsData);
      },
    );

    // Provide a category name that doesn't exist in base awards data
    const event = makeEvent({
      path: "/api/club/1/awards/2024/category",
      httpMethod: "PUT",
      body: JSON.stringify({
        categories: ["Nonexistent Category", "Also Nonexistent"],
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    // Router catches thrown errors and returns 500
    expect(response.statusCode).toBe(500);
  });
});

// ─── DELETE /:year/category/:awardTitle ───────────────────────────────────────

describe("DELETE /api/club/:clubSlug/awards/:year/category/:awardTitle", () => {
  it("returns 200 when category is deleted successfully", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/category/Best%20Picture",
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
  });
});

// ─── POST /:year/nomination ───────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/awards/:year/nomination", () => {
  it("returns 200 when nomination is added successfully", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination",
      httpMethod: "POST",
      body: JSON.stringify({
        awardTitle: "Best Picture",
        movieId: 550,
        nominatedBy: "user-1",
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(AwardsRepository.updateByYear).toHaveBeenCalledWith(
      "1",
      2024,
      expect.any(Function),
    );
  });

  it("adds to nominatedBy when movie is already nominated", async () => {
    setupClubAndYear();
    let capturedUpdater:
      | ((data: typeof baseAwardsData) => typeof baseAwardsData)
      | undefined;
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        capturedUpdater = updater;
      },
    );

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination",
      httpMethod: "POST",
      body: JSON.stringify({
        awardTitle: "Best Picture",
        movieId: 27205, // already in baseAwardsData
        nominatedBy: "user-2",
      }),
    });

    assertResponse(await handler(event, stubContext));

    // Invoke the captured updater to verify data transformation
    const result = capturedUpdater?.(baseAwardsData);
    const bestPicture = result?.awards.find((a) => a.title === "Best Picture");
    const nomination = bestPicture?.nominations.find(
      (n) => n.movieId === 27205,
    );
    expect(nomination?.nominatedBy).toContain("user-2");
  });

  it("creates new nomination when movie not yet nominated", async () => {
    setupClubAndYear();
    let capturedUpdater:
      | ((data: typeof baseAwardsData) => typeof baseAwardsData)
      | undefined;
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        capturedUpdater = updater;
      },
    );

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination",
      httpMethod: "POST",
      body: JSON.stringify({
        awardTitle: "Best Picture",
        movieId: 999,
        nominatedBy: "user-1",
      }),
    });

    assertResponse(await handler(event, stubContext));

    const result = capturedUpdater?.(baseAwardsData);
    const bestPicture = result?.awards.find((a) => a.title === "Best Picture");
    expect(bestPicture?.nominations).toHaveLength(2);
    const newNomination = bestPicture?.nominations.find(
      (n) => n.movieId === 999,
    );
    expect(newNomination?.nominatedBy).toEqual(["user-1"]);
    expect(newNomination?.ranking).toEqual({});
  });

  it("returns 400 when body is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination",
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body schema is invalid", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination",
      httpMethod: "POST",
      body: JSON.stringify({ awardTitle: "Best Picture" }), // missing movieId
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── DELETE /:year/nomination/:movieId ────────────────────────────────────────

describe("DELETE /api/club/:clubSlug/awards/:year/nomination/:movieId", () => {
  it("returns 200 when nomination is removed", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination/27205",
      httpMethod: "DELETE",
      queryStringParameters: {
        awardTitle: "Best Picture",
        userId: "user-1",
      },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
  });

  it("removes user from nominatedBy and filters empty nominations", async () => {
    setupClubAndYear();
    let capturedUpdater:
      | ((data: typeof baseAwardsData) => typeof baseAwardsData)
      | undefined;
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        capturedUpdater = updater;
      },
    );

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination/27205",
      httpMethod: "DELETE",
      queryStringParameters: {
        awardTitle: "Best Picture",
        userId: "user-1",
      },
    });

    assertResponse(await handler(event, stubContext));

    // user-1 is the only nominator; removing should eliminate the nomination
    const result = capturedUpdater?.(baseAwardsData);
    const bestPicture = result?.awards.find((a) => a.title === "Best Picture");
    expect(bestPicture?.nominations).toHaveLength(0);
  });

  it("returns 400 when awardTitle query param is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination/27205",
      httpMethod: "DELETE",
      queryStringParameters: { userId: "user-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when userId query param is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/nomination/27205",
      httpMethod: "DELETE",
      queryStringParameters: { awardTitle: "Best Picture" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /:year/ranking ──────────────────────────────────────────────────────

describe("POST /api/club/:clubSlug/awards/:year/ranking", () => {
  it("returns 200 when ranking is submitted", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/ranking",
      httpMethod: "POST",
      body: JSON.stringify({
        awardTitle: "Best Picture",
        movies: [27205, 550],
        voter: "user-1",
      }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(AwardsRepository.updateByYear).toHaveBeenCalledWith(
      "1",
      2024,
      expect.any(Function),
    );
  });

  it("records voter ranking by position index", async () => {
    setupClubAndYear();
    let capturedUpdater:
      | ((data: typeof baseAwardsData) => typeof baseAwardsData)
      | undefined;
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        capturedUpdater = updater;
      },
    );

    const event = makeEvent({
      path: "/api/club/1/awards/2024/ranking",
      httpMethod: "POST",
      body: JSON.stringify({
        awardTitle: "Best Picture",
        movies: [27205],
        voter: "user-1",
      }),
    });

    assertResponse(await handler(event, stubContext));

    const result = capturedUpdater?.(baseAwardsData);
    const bestPicture = result?.awards.find((a) => a.title === "Best Picture");
    const nomination = bestPicture?.nominations.find(
      (n) => n.movieId === 27205,
    );
    expect(nomination?.ranking["user-1"]).toBe(1);
  });

  it("returns 400 when body is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/ranking",
      httpMethod: "POST",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body schema is invalid", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/ranking",
      httpMethod: "POST",
      body: JSON.stringify({ awardTitle: "Best Picture", voter: "user-1" }), // missing movies
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── PUT /:year/step ──────────────────────────────────────────────────────────

describe("PUT /api/club/:clubSlug/awards/:year/step", () => {
  it("returns 200 when step is updated", async () => {
    setupClubAndYear();
    vi.mocked(AwardsRepository.updateByYear).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/club/1/awards/2024/step",
      httpMethod: "PUT",
      body: JSON.stringify({ step: AwardsStep.Ratings }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(AwardsRepository.updateByYear).toHaveBeenCalledWith(
      "1",
      2024,
      expect.any(Function),
    );
  });

  it("persists the new step value in the updater", async () => {
    setupClubAndYear();
    let capturedUpdater:
      | ((data: typeof baseAwardsData) => typeof baseAwardsData)
      | undefined;
    vi.mocked(AwardsRepository.updateByYear).mockImplementationOnce(
      async (_clubId, _year, updater) => {
        capturedUpdater = updater;
      },
    );

    const event = makeEvent({
      path: "/api/club/1/awards/2024/step",
      httpMethod: "PUT",
      body: JSON.stringify({ step: AwardsStep.Presentation }),
    });

    assertResponse(await handler(event, stubContext));

    const result = capturedUpdater?.(baseAwardsData);
    expect(result?.step).toBe(AwardsStep.Presentation);
  });

  it("returns 400 when body is missing", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/step",
      httpMethod: "PUT",
      body: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when body schema is invalid (step must be number)", async () => {
    setupClubAndYear();

    const event = makeEvent({
      path: "/api/club/1/awards/2024/step",
      httpMethod: "PUT",
      body: JSON.stringify({ step: "invalid" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});
