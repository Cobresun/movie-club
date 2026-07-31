/**
 * Integration tests for `netlify/functions/club/members.ts` and
 * `club/members/join.ts` — membership listing, leaving, removal, and the
 * invite-token join flow, all against real rows.
 */
import { describe, expect, it } from "vitest";

import { Member } from "../../../lib/types/club";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import { addMember, createClub, createInvite, createUser } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/club/:clubSlug/members", () => {
  it("returns every member with their profile and role", async () => {
    const club = await createClub();
    const admin = await createUser({ name: "Admin" });
    const regular = await createUser({ name: "Regular" });
    await addMember(club.id, admin.userId, "admin");
    await addMember(club.id, regular.userId);
    await db
      .updateTable("user")
      .set({ image: "https://images.example/admin.jpg" })
      .where("id", "=", admin.userId)
      .execute();

    const res = await api.get<Member[]>(`/api/club/${club.slug}/members`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      id: admin.userId,
      email: admin.email,
      name: "Admin",
      image: "https://images.example/admin.jpg",
      role: "admin",
    });
    expect(res.body).toContainEqual({
      id: regular.userId,
      email: regular.email,
      name: "Regular",
      role: "member",
    });
  });

  it("returns an empty list for a club with no members", async () => {
    const club = await createClub();

    const res = await api.get<Member[]>(`/api/club/${club.slug}/members`);

    expect(res.body).toEqual([]);
  });

  it("does not leak another club's members", async () => {
    const club = await createClub();
    const other = await createClub();
    const outsider = await createUser({ name: "Outsider" });
    await addMember(other.id, outsider.userId);

    const res = await api.get<Member[]>(`/api/club/${club.slug}/members`);

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
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.delete(`/api/club/${club.slug}/members/self`, { as: alice });

    expect(res.statusCode).toBe(200);
    const members = await api.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body).toEqual([]);
  });

  it("returns 401 without a session", async () => {
    const club = await createClub();

    const res = await api.delete(`/api/club/${club.slug}/members/self`);

    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/club/:clubSlug/members/:memberId", () => {
  it("removes another member", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const other = await createUser({ name: "Other" });
    await addMember(club.id, other.userId);

    const res = await api.delete(`/api/club/${club.slug}/members/${other.userId}`, { as: alice });

    expect(res.statusCode).toBe(200);
    const members = await api.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body.map((member) => member.id)).toEqual([alice.userId]);
  });

  it("returns 401 for a signed-in user outside the club", async () => {
    const bob = await signIn("bob");
    const club = await createClub();
    const other = await createUser({ name: "Other" });
    await addMember(club.id, other.userId);

    const res = await api.delete(`/api/club/${club.slug}/members/${other.userId}`, { as: bob });

    expect(res.statusCode).toBe(401);
    const members = await api.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body).toHaveLength(1);
  });
});

describe("GET /api/club/:clubSlug/members/join", () => {
  it("adds the signed-in user to the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub();

    const res = await api.get(`/api/club/${club.slug}/members/join`, { as: alice });

    expect(res.statusCode).toBe(200);
    const members = await api.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body.map((member) => member.id)).toEqual([alice.userId]);
  });

  it("returns 401 without a session", async () => {
    const club = await createClub();

    const res = await api.get(`/api/club/${club.slug}/members/join`);

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/club/join", () => {
  it("joins the club the invite token belongs to", async () => {
    const alice = await signIn("alice");
    const club = await createClub();
    const token = await createInvite(club.id);

    const res = await api.post(`/api/club/join`, { body: { token }, as: alice });

    expect(res.statusCode).toBe(200);
    const members = await api.get<Member[]>(`/api/club/${club.slug}/members`);
    expect(members.body.map((member) => [member.id, member.role])).toEqual([
      [alice.userId, "member"],
    ]);
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

  it("rejects an expired token and deletes it", async () => {
    const alice = await signIn("alice");
    const club = await createClub();
    const token = await createInvite(club.id, { expiresAt: new Date(Date.now() - 1000) });

    const res = await api.post<{ error: string }>(`/api/club/join`, { body: { token }, as: alice });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invite token expired");
    const remaining = await db
      .selectFrom("club_invite")
      .select("token")
      .where("club_id", "=", club.id)
      .execute();
    expect(remaining).toEqual([]);
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
    const club = await createClub();
    const token = await createInvite(club.id);

    const res = await api.post(`/api/club/join`, { body: { token } });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/club/joinInfo/:token", () => {
  it("returns the club behind a valid token", async () => {
    const club = await createClub({ name: "Invite Club" });
    const token = await createInvite(club.id);

    const res = await api.get<{ clubId: string; clubName: string }>(`/api/club/joinInfo/${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.clubId).toBe(club.id);
    expect(res.body.clubName).toBe("Invite Club");
  });

  it("returns 400 for an expired token", async () => {
    const club = await createClub();
    const token = await createInvite(club.id, { expiresAt: new Date(Date.now() - 1000) });

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
