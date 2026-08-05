/**
 * Integration tests for `netlify/functions/club/invite.ts` — issuing club
 * invite tokens, including the reuse and expiry-cleanup behaviour that lives in
 * `ClubRepository.createClubInvite`.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { createClub, createInvite, expireInvite } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("POST /api/club/:clubSlug/invite", () => {
  it("issues a token that the join-info endpoint resolves back to the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { name: "Invite Club" });

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);

    const info = await api.get<{ clubName: string }>(`/api/club/joinInfo/${res.body.token}`);
    expect(info.body.clubName).toBe("Invite Club");
  });

  it("reuses the club's live invite rather than issuing a second one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const existing = await createInvite(club, alice);

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.body.token).toBe(existing);
  });

  it("retires an expired invite and issues a fresh one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const stale = await createInvite(club, alice);
    await expireInvite(stale);

    const res = await api.post<{ token: string }>(`/api/club/${club.slug}/invite`);

    expect(res.body.token).not.toBe(stale);
    // The old token no longer resolves; the new one does.
    expect((await api.get<{ error: string }>(`/api/club/joinInfo/${stale}`)).body.error).toBe(
      "Invalid invite token",
    );
    const info = await api.get<{ clubId: string }>(`/api/club/joinInfo/${res.body.token}`);
    expect(info.body.clubId).toBe(club.id);
  });

  it("returns 404 for an unknown club", async () => {
    const res = await api.post("/api/club/not-a-club/invite");

    expect(res.statusCode).toBe(404);
  });
});
