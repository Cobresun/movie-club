/**
 * Integration tests for `netlify/functions/club/invite.ts` — issuing club
 * invite tokens, including the reuse and expiry-cleanup behaviour that lives in
 * `ClubRepository.createClubInvite`.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../club/index";
import { db } from "./helpers/database";
import { createClub, createInvite } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("POST /api/club/:clubSlug/invite", () => {
  it("issues a token that the join-info endpoint resolves back to the club", async () => {
    const club = await createClub({ name: "Invite Club" });

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);

    const info = await api.get<{ clubName: string }>(`/api/club/joinInfo/${res.body.token}`);
    expect(info.body.clubName).toBe("Invite Club");
  });

  it("reuses the club's live invite and pushes its expiry out", async () => {
    const club = await createClub();
    const existing = await createInvite(club.id, {
      token: "existing-token",
      expiresAt: new Date(Date.now() + 60 * 1000),
    });

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.body.token).toBe(existing);
    const invites = await db
      .selectFrom("club_invite")
      .select(["token", "expires_at"])
      .where("club_id", "=", club.id)
      .execute();
    expect(invites).toHaveLength(1);
    expect(invites[0].expires_at.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it("clears an expired invite and issues a fresh one", async () => {
    const club = await createClub();
    await createInvite(club.id, {
      token: "stale-token",
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.body.token).not.toBe("stale-token");
    const invites = await db
      .selectFrom("club_invite")
      .select("token")
      .where("club_id", "=", club.id)
      .execute();
    expect(invites).toEqual([{ token: res.body.token }]);
  });

  it("returns 404 for an unknown club", async () => {
    const res = await api.post("/api/club/not-a-club/invite");

    expect(res.statusCode).toBe(404);
  });
});
