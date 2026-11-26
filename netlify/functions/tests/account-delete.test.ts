/**
 * Integration tests for `netlify/functions/account-delete.ts`, BetterAuth's
 * `POST /api/auth/delete-user` with the member's avatar removed alongside.
 *
 * Every test deletes a throwaway account from `signInNewUser`: the fixture
 * users are shared by the whole run.
 */
import { http, HttpResponse } from "msw";

import { type Member } from "../../../lib/types/club";
import { type ReviewScores, type WorkCommentDto } from "../../../lib/types/lists";
import { handler } from "../account-delete";
import { handler as authHandler } from "../auth";
import { handler as clubHandler } from "../club/index";
import { AUTH_HEADERS, FIXTURE_PASSWORD, signIn, signInNewUser } from "./helpers/auth";
import {
  addComment,
  addReviewedWork,
  createClub,
  scoreWork,
  uploadAvatar,
} from "./helpers/factories";
import { requester } from "./helpers/http";
import { CLOUDINARY_DESTROY, server } from "./setup/externalApis";

const api = requester(handler);
const authApi = requester(authHandler);
const clubApi = requester(clubHandler);

let counter = 0;
const freshEmail = () => `leaving-${Date.now().toString(36)}-${(counter += 1)}@movie.club`;

const deleteAccount = (cookie: string | undefined, password?: string) =>
  api.post<{ success: boolean }>("/api/auth/delete-user", {
    body: password === undefined ? {} : { password },
    headers: { ...AUTH_HEADERS, ...(cookie === undefined ? {} : { cookie }) },
  });

const signInAgain = (email: string) =>
  authApi.post("/api/auth/sign-in/email", {
    body: { email, password: FIXTURE_PASSWORD },
    headers: AUTH_HEADERS,
  });

describe("POST /api/auth/delete-user", () => {
  it("removes the member, their scores and their comments from every club", async () => {
    const alice = await signIn("alice");
    const leaving = await signInNewUser(freshEmail(), "Leaving");
    const club = await createClub(alice, { members: [alice, leaving] });
    const work = await addReviewedWork(club, alice);
    await scoreWork(club, leaving, work.id, 7);
    await addComment(club, leaving, work.id, "See you around");

    const res = await deleteAccount(leaving.cookie, FIXTURE_PASSWORD);

    expect(res.statusCode).toBe(200);
    const members = await clubApi.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body.map((member) => member.id)).toStrictEqual([alice.userId]);
    const scores = await clubApi.get<ReviewScores>(
      `/api/club/${club.slug}/reviews/${work.id}/scores`,
      { as: alice },
    );
    expect(scores.body).not.toHaveProperty(leaving.userId);
    const comments = await clubApi.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body).toStrictEqual([]);
  });

  it("signs the member out and refuses their password afterwards", async () => {
    const leaving = await signInNewUser(freshEmail());

    const res = await deleteAccount(leaving.cookie, FIXTURE_PASSWORD);

    const cleared = res.multiValueHeaders["Set-Cookie"] ?? [];
    expect(cleared.find((cookie) => cookie.includes("session_token="))).toMatch(/Max-Age=0/i);
    expect((await signInAgain(leaving.email)).statusCode).toBe(401);
  });

  it("refuses the wrong password and keeps the account", async () => {
    const alice = await signIn("alice");
    const staying = await signInNewUser(freshEmail(), "Staying");
    const club = await createClub(alice, { members: [alice, staying] });

    const res = await deleteAccount(staying.cookie, "not-my-password");

    expect(res.statusCode).toBe(400);
    expect((await signInAgain(staying.email)).statusCode).toBe(200);
    const members = await clubApi.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body.map((member) => member.id)).toContain(staying.userId);
  });

  it("still deletes the account when its photo can't be removed", async () => {
    const leaving = await signInNewUser(freshEmail());
    await uploadAvatar(leaving);
    server.use(http.post(CLOUDINARY_DESTROY, () => new HttpResponse(null, { status: 500 })));

    const res = await deleteAccount(leaving.cookie, FIXTURE_PASSWORD);

    expect(res.statusCode).toBe(200);
    expect((await signInAgain(leaving.email)).statusCode).toBe(401);
  });

  it("returns 401 without a session", async () => {
    const res = await deleteAccount(undefined, FIXTURE_PASSWORD);

    expect(res.statusCode).toBe(401);
  });
});

describe("the auth function", () => {
  it("does not offer account deletion itself", async () => {
    const staying = await signInNewUser(freshEmail());

    const res = await authApi.post("/api/auth/delete-user", {
      body: { password: FIXTURE_PASSWORD },
      headers: { ...AUTH_HEADERS, cookie: staying.cookie },
    });

    expect(res.statusCode).toBe(404);
    expect((await signInAgain(staying.email)).statusCode).toBe(200);
  });
});
