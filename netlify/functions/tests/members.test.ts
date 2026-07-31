/**
 * Integration tests for `netlify/functions/club/members.ts` and
 * `club/members/join.ts` — membership listing, leaving, removal, and the
 * invite-token join flow.
 */
import { describe, expect, it } from "vitest";

import { Member } from "../../../lib/types/club";
import { handler as clubHandler } from "../club/index";
import { handler as memberHandler } from "../member";
import { signIn, TestSession } from "./helpers/auth";
import { createClub, createInvite, expireInvite, joinClub } from "./helpers/factories";
import { makeEvent, requester } from "./helpers/http";

const api = requester(clubHandler);
const memberApi = requester(memberHandler);

const membersOf = (slug: string) => api.get<Member[]>(`/api/club/${slug}/members`);

/** Upload an avatar as `session`, so a test can assert the image comes back. */
async function uploadAvatar(session: TestSession) {
  const boundary = "----movieclubtestboundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="avatar.png"',
    "Content-Type: image/png",
    "",
    "pretend-png-bytes",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return memberApi.send(
    makeEvent({
      path: "/api/member/avatar",
      httpMethod: "POST",
      body,
      as: session,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    }),
  );
}

describe("GET /api/club/:clubSlug/members", () => {
  it("returns every member with their profile and role", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    await uploadAvatar(alice);

    const res = await membersOf(club.slug);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      id: alice.userId,
      email: alice.email,
      name: "Alice",
      image: "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg",
      role: "admin",
    });
    expect(res.body).toContainEqual({
      id: bob.userId,
      email: bob.email,
      name: "Bob",
      role: "member",
    });
  });

  it("returns an empty list for a club with no members", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { members: [] });

    const res = await membersOf(club.slug);

    expect(res.body).toEqual([]);
  });

  it("does not leak another club's members", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [] });
    await createClub(bob, { members: [bob] });

    const res = await membersOf(club.slug);

    expect(res.body).toEqual([]);
  });

  it("returns 404 for an unknown club", async () => {
    const res = await api.get("/api/club/no-such-club/members");

    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/club/:clubSlug/members/self", () => {
  it("removes the authenticated member from the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.delete(`/api/club/${club.slug}/members/self`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect((await membersOf(club.slug)).body).toEqual([]);
  });

  it("returns 401 without a session", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.delete(`/api/club/${club.slug}/members/self`);

    expect(res.statusCode).toBe(401);
    expect((await membersOf(club.slug)).body).toHaveLength(1);
  });
});

describe("DELETE /api/club/:clubSlug/members/:memberId", () => {
  it("removes another member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });

    const res = await api.delete(`/api/club/${club.slug}/members/${bob.userId}`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect((await membersOf(club.slug)).body.map((member) => member.id)).toEqual([alice.userId]);
  });

  it("returns 401 for a signed-in user outside the club", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.delete(`/api/club/${club.slug}/members/${alice.userId}`, { as: bob });

    expect(res.statusCode).toBe(401);
    expect((await membersOf(club.slug)).body).toHaveLength(1);
  });
});

describe("GET /api/club/:clubSlug/members/join", () => {
  it("adds the signed-in user to the club", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.get(`/api/club/${club.slug}/members/join`, { as: bob });

    expect(res.statusCode).toBe(200);
    expect((await membersOf(club.slug)).body.map((member) => member.id).sort()).toEqual(
      [alice.userId, bob.userId].sort(),
    );
  });

  it("returns 401 without a session", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { members: [] });

    const res = await api.get(`/api/club/${club.slug}/members/join`);

    expect(res.statusCode).toBe(401);
    expect((await membersOf(club.slug)).body).toEqual([]);
  });
});

describe("POST /api/club/join", () => {
  it("joins the club the invite token belongs to", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    const token = await createInvite(club, alice);

    const res = await api.post(`/api/club/join`, { body: { token }, as: bob });

    expect(res.statusCode).toBe(200);
    const members = await membersOf(club.slug);
    expect(members.body).toContainEqual(
      expect.objectContaining({ id: bob.userId, role: "member" }),
    );
  });

  it("shows up in the joiner's own club list", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { name: "Joinable", members: [alice] });
    const token = await createInvite(club, alice);

    await api.post(`/api/club/join`, { body: { token }, as: bob });

    const clubs = await memberApi.get<{ clubName: string }[]>("/api/member/clubs", { as: bob });
    expect(clubs.body.map((entry) => entry.clubName)).toEqual(["Joinable"]);
  });

  it("rejects an unknown token", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ error: string }>(`/api/club/join`, {
      body: { token: "made-up" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid invite token");
  });

  it("rejects an expired token and retires it", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    const token = await createInvite(club, alice);
    await expireInvite(token);

    const res = await api.post<{ error: string }>(`/api/club/join`, { body: { token }, as: bob });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invite token expired");
    expect((await membersOf(club.slug)).body).toHaveLength(1);

    // The expired token is gone, so it now reads as invalid rather than stale.
    const retry = await api.post<{ error: string }>(`/api/club/join`, { body: { token }, as: bob });
    expect(retry.body.error).toBe("Invalid invite token");
  });

  it.each([
    ["no body", undefined],
    ["a body without a token", { notAToken: "x" }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");

    const res = await api.post(`/api/club/join`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 without a session", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { members: [alice] });
    const token = await createInvite(club, alice);

    const res = await api.post(`/api/club/join`, { body: { token } });

    expect(res.statusCode).toBe(401);
    expect((await membersOf(club.slug)).body).toHaveLength(1);
  });
});

describe("GET /api/club/joinInfo/:token", () => {
  it("returns the club behind a valid token", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { name: "Invite Club" });
    const token = await createInvite(club, alice);

    const res = await api.get<{ clubId: string; clubName: string }>(`/api/club/joinInfo/${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.clubId).toBe(club.id);
    expect(res.body.clubName).toBe("Invite Club");
  });

  it("returns 400 for an expired token", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const token = await createInvite(club, alice);
    await expireInvite(token);

    const res = await api.get<{ error: string }>(`/api/club/joinInfo/${token}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invite token expired");
  });

  it("returns 400 for an unknown token", async () => {
    const res = await api.get<{ error: string }>(`/api/club/joinInfo/nope`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid invite token");
  });
});

describe("leaving and rejoining", () => {
  it("drops the club from the member's own list and puts it back", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { name: "Revolving Door", members: [alice, bob] });

    await api.delete(`/api/club/${club.slug}/members/self`, { as: bob });
    expect((await memberApi.get<unknown[]>("/api/member/clubs", { as: bob })).body).toEqual([]);

    await joinClub(club, bob);
    const clubs = await memberApi.get<{ clubName: string }[]>("/api/member/clubs", { as: bob });
    expect(clubs.body.map((entry) => entry.clubName)).toEqual(["Revolving Door"]);
  });
});
