/**
 * Integration tests for `netlify/functions/member.ts` — the signed-in user's
 * own profile: their clubs, display name and avatar.
 *
 * The avatar routes run the real Cloudinary SDK against an MSW-intercepted
 * Cloudinary, so the multipart parsing and the upload/destroy calls are
 * genuinely exercised.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ClubPreview } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";
import { handler } from "../member";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import { createClub } from "./helpers/factories";
import { makeEvent, requester } from "./helpers/http";
import { requestsTo, server } from "./setup/externalApis";

const api = requester(handler);

/** A minimal multipart/form-data body carrying one file field. */
function multipartAvatar(filename = "avatar.png") {
  const boundary = "----movieclubtestboundary";
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    "Content-Type: image/png",
    "",
    "pretend-png-bytes",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return { boundary, body };
}

describe("GET /api/member/clubs", () => {
  it("returns a preview of every club the user belongs to", async () => {
    const alice = await signIn("alice");
    const movies = await createClub({
      name: "Movie Night",
      slug: "movie-night",
      members: [{ userId: alice.userId }],
    });
    await createClub({
      name: "Books",
      slug: "books-club",
      type: ClubType.book,
      members: [{ userId: alice.userId }],
    });
    await createClub({ name: "Not Mine", slug: "not-mine" });

    const res = await api.get<ClubPreview[]>("/api/member/clubs", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      clubId: movies.id,
      clubName: "Movie Night",
      slug: "movie-night",
      type: ClubType.movie,
    });
    expect(res.body.map((club) => club.clubName).sort()).toEqual(["Books", "Movie Night"]);
  });

  it("returns an empty list for a user in no clubs", async () => {
    const bob = await signIn("bob");

    const res = await api.get<ClubPreview[]>("/api/member/clubs", { as: bob });

    expect(res.body).toEqual([]);
  });

  it("returns 401 without a session", async () => {
    const res = await api.get("/api/member/clubs");

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/member/name", () => {
  it("renames the signed-in user", async () => {
    const alice = await signIn("alice");

    const res = await api.put("/api/member/name", { body: { name: "  Alice B  " }, as: alice });

    expect(res.statusCode).toBe(200);
    const row = await db
      .selectFrom("user")
      .select("name")
      .where("id", "=", alice.userId)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Alice B");
  });

  it.each([
    ["a name that is only whitespace", { name: "   " }, "Name cannot be empty"],
    ["a name over 100 characters", { name: "x".repeat(101) }, "Name is too long"],
  ])("returns 400 for %s", async (_label, body, message) => {
    const alice = await signIn("alice");

    const res = await api.put<{ error: string }>("/api/member/name", { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(message);
  });

  it("returns 401 without a session", async () => {
    const res = await api.put("/api/member/name", { body: { name: "Anon" } });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/member/avatar", () => {
  it("uploads the file to Cloudinary and stores the returned url", async () => {
    const alice = await signIn("alice");
    const { boundary, body } = multipartAvatar();

    const res = await api.send(
      makeEvent({
        path: "/api/member/avatar",
        httpMethod: "POST",
        body,
        as: alice,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(requestsTo("api.cloudinary.com")).toHaveLength(1);
    const row = await db
      .selectFrom("user")
      .select(["image", "image_id"])
      .where("id", "=", alice.userId)
      .executeTakeFirstOrThrow();
    expect(row.image).toBe("https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg");
    expect(row.image_id).toBe("avatar-public-id");
  });

  it("deletes the previous Cloudinary asset when replacing an avatar", async () => {
    const alice = await signIn("alice");
    await db
      .updateTable("user")
      .set({ image: "https://old.example/a.jpg", image_id: "old-public-id" })
      .where("id", "=", alice.userId)
      .execute();

    const destroyed: string[] = [];
    server.use(
      http.post("https://api.cloudinary.com/v1_1/:cloud/image/destroy", async ({ request }) => {
        destroyed.push(await request.text());
        return HttpResponse.json({ result: "ok" });
      }),
    );

    const { boundary, body } = multipartAvatar();
    const res = await api.send(
      makeEvent({
        path: "/api/member/avatar",
        httpMethod: "POST",
        body,
        as: alice,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(destroyed.join()).toContain("old-public-id");
  });

  it("returns 400 when the request carries no file", async () => {
    const alice = await signIn("alice");
    const boundary = "----movieclubtestboundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="note"',
      "",
      "hi",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const res = await api.send(
      makeEvent({
        path: "/api/member/avatar",
        httpMethod: "POST",
        body,
        as: alice,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      }),
    );

    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/member/avatar", () => {
  it("clears the avatar and deletes the Cloudinary asset", async () => {
    const alice = await signIn("alice");
    await db
      .updateTable("user")
      .set({ image: "https://old.example/a.jpg", image_id: "old-public-id" })
      .where("id", "=", alice.userId)
      .execute();

    const res = await api.delete("/api/member/avatar", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(requestsTo("api.cloudinary.com")).toHaveLength(1);
    const row = await db
      .selectFrom("user")
      .select(["image", "image_id"])
      .where("id", "=", alice.userId)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ image: null, image_id: null });
  });

  it("skips Cloudinary when the user has no stored asset", async () => {
    const alice = await signIn("alice");

    const res = await api.delete("/api/member/avatar", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(requestsTo("api.cloudinary.com")).toHaveLength(0);
  });

  it("returns 401 without a session", async () => {
    const res = await api.delete("/api/member/avatar");

    expect(res.statusCode).toBe(401);
  });
});

describe("routing", () => {
  it("returns 404 for an unknown path", async () => {
    const res = await api.get("/api/member/unknown");

    expect(res.statusCode).toBe(404);
  });

  it("returns 405 for a method the route does not define", async () => {
    const res = await api.post("/api/member/clubs");

    expect(res.statusCode).toBe(405);
  });
});
