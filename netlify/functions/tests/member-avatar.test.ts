/**
 * Integration tests for `netlify/functions/member-avatar.ts` — uploading and
 * removing the signed-in user's avatar.
 *
 * The routes run the real image-upload stack — multipart parsing and the SDK's
 * own requests — against an MSW-intercepted host. Where the file ends up is an
 * implementation detail; what the tests check is the round trip, read back off
 * the club members endpoint, which is where a client sees it.
 */
import { http, HttpResponse } from "msw";

import { type Member } from "../../../lib/types/club";
import { handler as clubHandler } from "../club/index";
import { handler } from "../member-avatar";
import { signIn, type TestSession } from "./helpers/auth";
import { createClub, type SeededClub } from "./helpers/factories";
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

/** The profile a club sees for `session` — how a client observes the avatar. */
async function profileIn(club: SeededClub, session: TestSession) {
  const members = await clubApi.get<Member[]>(`/api/club/${club.slug}/members`);
  return members.body.find((member) => member.id === session.userId);
}

describe("POST /api/member/avatar", () => {
  it("stores the uploaded file and shows it on the profile", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await uploadAvatar(alice);

    expect(res.statusCode).toBe(200);
    await expect(profileIn(club, alice)).resolves.toMatchObject({ image: AVATAR_URL });
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
    await expect(profileIn(club, alice)).resolves.toMatchObject({ image: REPLACEMENT_AVATAR_URL });
  });

  it("returns 400 when the request carries no file", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await uploadAvatar(alice, { note: "no file here" });

    expect(res.statusCode).toBe(400);
    await expect(profileIn(club, alice)).resolves.not.toHaveProperty("image");
  });
});

describe("DELETE /api/member/avatar", () => {
  it("clears the avatar off the profile", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await uploadAvatar(alice);

    const res = await api.delete("/api/member/avatar", { as: alice });

    expect(res.statusCode).toBe(200);
    await expect(profileIn(club, alice)).resolves.not.toHaveProperty("image");
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
