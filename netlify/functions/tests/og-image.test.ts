/**
 * Tests for netlify/functions/og-image.ts
 *
 * ClubRepository and SharedReviewService are mocked. The handler returns either
 * a 302 redirect (when poster_path is available), an SVG fallback, or an error
 * response.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

import { assertResponse, makeEvent, stubContext } from "./helpers";
import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { handler } from "../og-image";
import ClubRepository from "../repositories/ClubRepository";
import SharedReviewService from "../services/SharedReviewService";

// ─── Mock: auth ───────────────────────────────────────────────────────────────
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

// ─── Mock: database ───────────────────────────────────────────────────────────
vi.mock("../utils/database", () => ({
  db: {},
  pool: {},
  dialect: {},
  getDbUrl: vi.fn(),
}));

// ─── Mock: repositories ───────────────────────────────────────────────────────
vi.mock("../repositories/ClubRepository", () => ({
  default: {
    getBySlug: vi.fn(),
    getById: vi.fn(),
  },
}));

// ─── Mock: SharedReviewService ────────────────────────────────────────────────
vi.mock("../services/SharedReviewService", () => ({
  default: {
    getSharedReviewData: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockClub = {
  id: "1",
  name: "Test Club",
  slug: "test-club",
  type: ClubType.movie,
  legacy_id: null,
  slug_updated_at: null,
};

// The og-image handler redirects to the work's stored image URL (a TMDB poster
// for movies, an OpenLibrary cover for books); externalData is not consulted.
function makeReviewData(imageUrl: string | undefined) {
  return {
    work: {
      id: "work-1",
      title: "Inception",
      type: WorkType.movie,
      imageUrl,
      externalId: undefined,
      externalData: undefined,
    },
    reviews: [
      {
        score: "8",
        user_id: "user-1",
        review_id: "r1",
        created_date: new Date(),
      },
      {
        score: "7",
        user_id: "user-2",
        review_id: "r2",
        created_date: new Date(),
      },
    ],
    members: [],
    comments: [],
    clubName: "Test Club",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/og-image ────────────────────────────────────────────────────────

describe("GET /api/og-image", () => {
  it("redirects to the work's stored image URL when present", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue(
      makeReviewData("https://image.tmdb.org/t/p/w500/poster.jpg"),
    );

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(302);
    expect(response.headers?.["Location"]).toContain(
      "https://image.tmdb.org/t/p/w500/poster.jpg",
    );
  });

  it("returns SVG fallback when imageUrl is undefined", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue(
      makeReviewData(undefined),
    );

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("image/svg+xml");
    expect(response.body).toContain("<svg");
    expect(response.body).toContain("Inception");
  });

  it("includes average score in SVG when reviews are present", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue(
      makeReviewData(undefined),
    );

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    // scores are 8 and 7; average = 7.5
    expect(response.body).toContain("7.5");
  });

  it("returns 400 when clubSlug is missing", async () => {
    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when workId is missing", async () => {
    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when both parameters are missing", async () => {
    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: null,
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 404 when club is not found", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "unknown-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });

  it("returns SVG fallback when review data is null (work not found)", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue(null);

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "missing-work" },
    });

    const response = assertResponse(await handler(event, stubContext));

    // Falls back to SVG with generic title
    expect(response.statusCode).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("image/svg+xml");
  });

  it("returns SVG fallback when SharedReviewService throws", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockRejectedValue(
      new Error("Database error"),
    );

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(response.headers?.["Content-Type"]).toBe("image/svg+xml");
  });

  it("shows N/A score in SVG when no reviews have valid scores", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(mockClub);
    vi.mocked(SharedReviewService.getSharedReviewData).mockResolvedValue({
      work: {
        id: "work-1",
        title: "Unknown",
        type: WorkType.movie,
        imageUrl: undefined,
        externalId: undefined,
        externalData: undefined,
      },
      reviews: [],
      members: [],
      comments: [],
      clubName: "Test Club",
    });

    const event = makeEvent({
      path: "/api/og-image",
      httpMethod: "GET",
      queryStringParameters: { clubSlug: "test-club", workId: "work-1" },
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.body).toContain("N/A");
  });
});
