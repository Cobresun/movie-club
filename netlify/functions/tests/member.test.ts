/**
 * Tests for netlify/functions/member.ts
 *
 * Covers: GET /clubs, PUT /name, DELETE /avatar, POST /avatar (thin wrapper
 * around multipart-parse — the success path is skipped; see rationale below).
 */
import { UpdateResult } from "kysely";
import { parse } from "lambda-multipart-parser";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { handler } from "../member";
import { assertResponse, makeEvent, parseBody, stubContext } from "./helpers";
import { ClubType } from "../../../lib/types/generated/db";
import ClubRepository from "../repositories/ClubRepository";
import ImageRepository from "../repositories/ImageRepository";
import UserRepository from "../repositories/UserRepository";

// ─── Mock: auth ──────────────────────────────────────────────────────────────
vi.mock("./utils/auth", () => ({
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
    getClubPreviewsByUserId: vi.fn(),
  },
}));

vi.mock("../repositories/UserRepository", () => ({
  default: {
    getUserById: vi.fn(),
    updateImage: vi.fn(),
    updateName: vi.fn(),
  },
}));

vi.mock("../repositories/ImageRepository", () => ({
  default: {
    upload: vi.fn(),
    destroy: vi.fn(),
  },
}));

// lambda-multipart-parser is used in POST /avatar; mock it to control parse
vi.mock("lambda-multipart-parser", () => ({
  parse: vi.fn(),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /clubs ───────────────────────────────────────────────────────────────

describe("GET /api/member/clubs", () => {
  it("returns 200 with club previews for the authenticated user", async () => {
    vi.mocked(ClubRepository.getClubPreviewsByUserId).mockResolvedValue([
      {
        club_id: "club-1",
        club_name: "Test Club",
        slug: "test-club",
        type: ClubType.movie,
        slug_updated_at: null,
      },
    ]);

    const event = makeEvent({
      path: "/api/member/clubs",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<
      Array<{ clubId: string; clubName: string; slug: string }>
    >(response.body);
    expect(body).toHaveLength(1);
    expect(body[0].clubId).toBe("club-1");
    expect(body[0].slug).toBe("test-club");
  });

  it("returns 200 with empty array when user has no clubs", async () => {
    vi.mocked(ClubRepository.getClubPreviewsByUserId).mockResolvedValue([]);

    const event = makeEvent({
      path: "/api/member/clubs",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    const body = parseBody<unknown[]>(response.body);
    expect(body).toHaveLength(0);
  });

  it("returns 401 when user is not authenticated", async () => {
    const { loggedIn } = await import("../utils/auth");
    vi.mocked(loggedIn).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: "/api/member/clubs",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});

// ─── PUT /name ────────────────────────────────────────────────────────────────

describe("PUT /api/member/name", () => {
  it("returns 200 when name is updated successfully", async () => {
    vi.mocked(UserRepository.updateName).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: "/api/member/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "Alice" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(UserRepository.updateName).toHaveBeenCalledWith("user-1", "Alice");
  });

  it("returns 400 when name is empty after trim", async () => {
    const event = makeEvent({
      path: "/api/member/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "   " }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 400 when name exceeds 100 characters", async () => {
    const event = makeEvent({
      path: "/api/member/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "a".repeat(101) }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });

  it("returns 401 when user is not authenticated", async () => {
    const { loggedIn } = await import("../utils/auth");
    vi.mocked(loggedIn).mockImplementationOnce(async (_req, res) =>
      res({ statusCode: 401, body: "" }),
    );

    const event = makeEvent({
      path: "/api/member/name",
      httpMethod: "PUT",
      body: JSON.stringify({ name: "Alice" }),
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(401);
  });
});

// ─── DELETE /avatar ───────────────────────────────────────────────────────────

describe("DELETE /api/member/avatar", () => {
  it("returns 200 when avatar with Cloudinary asset is deleted", async () => {
    vi.mocked(UserRepository.getUserById).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Alice",
      image: "https://res.cloudinary.com/example/image.jpg",
      image_id: "cloudinary-public-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    });
    vi.mocked(ImageRepository.destroy).mockResolvedValue(undefined);
    vi.mocked(UserRepository.updateImage).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: "/api/member/avatar",
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ImageRepository.destroy).toHaveBeenCalledWith(
      "cloudinary-public-id",
    );
    expect(UserRepository.updateImage).toHaveBeenCalledWith(
      "user-1",
      null,
      null,
    );
  });

  it("returns 200 and skips Cloudinary delete when user has no image_id", async () => {
    vi.mocked(UserRepository.getUserById).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Alice",
      image: null,
      image_id: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
    });
    vi.mocked(UserRepository.updateImage).mockResolvedValue([
      new UpdateResult(0n, undefined),
    ]);

    const event = makeEvent({
      path: "/api/member/avatar",
      httpMethod: "DELETE",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(200);
    expect(ImageRepository.destroy).not.toHaveBeenCalled();
  });
});

// ─── POST /avatar ─────────────────────────────────────────────────────────────
// The success path requires a real multipart body including a file buffer, which
// is impractical to construct in a unit test.  We cover the "no file uploaded"
// error branch and leave the happy path for integration tests.

describe("POST /api/member/avatar", () => {
  it("returns 400 when no file is included in the multipart request", async () => {
    // MultipartRequest is an intersection with Record<string, string>, which a
    // plain object literal cannot satisfy; a typed Object.assign builds it
    // without resorting to an `as` cast.
    type MultipartRequest = Awaited<ReturnType<typeof parse>>;
    const emptyMultipart = Object.assign<
      Record<string, string>,
      Pick<MultipartRequest, "files">
    >({}, { files: [] });
    vi.mocked(parse).mockResolvedValue(emptyMultipart);

    const event = makeEvent({
      path: "/api/member/avatar",
      httpMethod: "POST",
      headers: { "content-type": "multipart/form-data; boundary=boundary" },
      body: "",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(400);
  });
});

// ─── 404 / 405 routing ───────────────────────────────────────────────────────

describe("routing: unknown paths and wrong methods", () => {
  it("returns 404 for an unknown path under /api/member", async () => {
    const event = makeEvent({
      path: "/api/member/unknown-endpoint",
      httpMethod: "GET",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(404);
  });

  it("returns 405 when wrong HTTP method is used on known route", async () => {
    const event = makeEvent({
      path: "/api/member/clubs",
      httpMethod: "POST",
    });

    const response = assertResponse(await handler(event, stubContext));

    expect(response.statusCode).toBe(405);
  });
});
