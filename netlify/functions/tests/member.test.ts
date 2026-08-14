/**
 * Integration tests for `netlify/functions/member.ts` — the signed-in user's
 * own profile: their clubs, display name and avatar.
 *
 * The avatar routes run the real image-upload stack — multipart parsing and
 * the SDK's own requests — against an MSW-intercepted host. Where the file
 * ends up is an implementation detail; what the tests check is the round trip,
 * read back off the club members endpoint, which is where a client sees it.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ClubPreview, Member } from "../../../lib/types/club";
import { ClubType } from "../../../lib/types/generated/db";
import { handler as clubHandler } from "../club/index";
import { handler } from "../member";
import { signIn, TestSession } from "./helpers/auth";
import { createClub, SeededClub } from "./helpers/factories";
import { makeEvent, requester } from "./helpers/http";
import { CLOUDINARY_DESTROY, CLOUDINARY_UPLOAD, failOnRequest, server } from "./setup/externalApis";

const api = requester(handler);
const clubApi = requester(clubHandler);

const AVATAR_URL = "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg";
const REPLACEMENT_AVATAR_URL = "https://res.cloudinary.com/test-cloud/image/upload/second.jpg";

/** A minimal multipart/form-data body carrying one file field. */
function multipartAvatar(fields: { file?: string; note?: string } = { file: "avatar.png" }) {
  const boundary = "----movieclubtestboundary";
  const parts = [`--${boundary}`];
  if (fields.file !== undefined) {
    parts.push(
      `Content-Disposition: form-data; name="file"; filename="${fields.file}"`,
      "Content-Type: image/png",
      "",
      "pretend-png-bytes",
    );
  } else {
    parts.push('Content-Disposition: form-data; name="note"', "", fields.note ?? "hi");
  }
  parts.push(`--${boundary}--`, "");

  return { boundary, body: parts.join("\r\n") };
}

function uploadAvatar(session: TestSession, fields?: Parameters<typeof multipartAvatar>[0]) {
  const { boundary, body } = multipartAvatar(fields);
  return api.send(
    makeEvent({
      path: "/api/member/avatar",
      httpMethod: "POST",
      body,
      as: session,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    }),
  );
}

/** The profile a club sees for `session` — how a client observes name and avatar. */
async function profileIn(club: SeededClub, session: TestSession) {
  const members = await clubApi.get<Member[]>(`/api/club/${club.slug}/members`);
  return members.body.find((member) => member.id === session.userId);
}

describe("GET /api/member/clubs", () => {
  it("returns a preview of every club the user belongs to", async () => {
    const alice = await signIn("alice");
    const movies = await createClub(alice, { name: "Movie Night" });
    await createClub(alice, { name: "Books", type: ClubType.book });
    await createClub(alice, { name: "Not Mine", members: [] });

    const res = await api.get<ClubPreview[]>("/api/member/clubs", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      clubId: movies.id,
      clubName: "Movie Night",
      slug: movies.slug,
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
  it("renames the signed-in user everywhere they appear", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put("/api/member/name", { body: { name: "  Alice B  " }, as: alice });

    expect(res.statusCode).toBe(200);
    expect(await profileIn(club, alice)).toMatchObject({ name: "Alice B" });
  });

  it.each([
    ["a name that is only whitespace", { name: "   " }, "Name cannot be empty"],
    ["a name over 100 characters", { name: "x".repeat(101) }, "Name is too long"],
  ])("returns 400 for %s", async (_label, body, message) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put<{ error: string }>("/api/member/name", { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(message);
    expect(await profileIn(club, alice)).toMatchObject({ name: "Alice" });
  });

  it("returns 401 without a session", async () => {
    const res = await api.put("/api/member/name", { body: { name: "Anon" } });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/member/avatar", () => {
  it("stores the uploaded file and shows it on the profile", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await uploadAvatar(alice);

    expect(res.statusCode).toBe(200);
    expect(await profileIn(club, alice)).toMatchObject({ image: AVATAR_URL });
  });

  it("replaces an existing avatar with the newly uploaded one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await uploadAvatar(alice);

    server.use(
      http.post(CLOUDINARY_UPLOAD, () =>
        HttpResponse.json({ secure_url: REPLACEMENT_AVATAR_URL, public_id: "second-public-id" }),
      ),
    );

    const res = await uploadAvatar(alice);

    expect(res.statusCode).toBe(200);
    expect(await profileIn(club, alice)).toMatchObject({ image: REPLACEMENT_AVATAR_URL });
  });

  it("returns 400 when the request carries no file", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await uploadAvatar(alice, { note: "no file here" });

    expect(res.statusCode).toBe(400);
    expect(await profileIn(club, alice)).not.toHaveProperty("image");
  });
});

describe("DELETE /api/member/avatar", () => {
  it("clears the avatar off the profile", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await uploadAvatar(alice);

    const res = await api.delete("/api/member/avatar", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(await profileIn(club, alice)).not.toHaveProperty("image");
  });

  it("succeeds when the user has no stored avatar", async () => {
    const alice = await signIn("alice");
    // Nothing was ever uploaded, so there is nothing to delete remotely.
    failOnRequest("post", CLOUDINARY_DESTROY);

    const res = await api.delete("/api/member/avatar", { as: alice });

    expect(res.statusCode).toBe(200);
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
