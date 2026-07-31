/**
 * Integration tests for `netlify/functions/club/settings.ts` — the club feature
 * flags, stored as a JSON blob in `club_settings` and merged on write.
 */
import { describe, expect, it } from "vitest";

import { handler } from "../club/index";
import { ClubSettings } from "../repositories/SettingsRepository";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import { createClub } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/club/:clubSlug/settings", () => {
  it("returns the club's stored feature flags", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { awards: true },
    });

    const res = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ features: { awards: true, discussionQuestions: false } });
  });

  it("falls back to all-off defaults when the club has no settings row", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    await db.deleteFrom("club_settings").where("club_id", "=", club.id).execute();

    const res = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });

    expect(res.body).toEqual({ features: { awards: false, discussionQuestions: false } });
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();

    const res = await api.get(`/api/club/${club.slug}/settings`, { as: bob });

    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for an unknown club", async () => {
    const alice = await signIn("alice");

    const res = await api.get("/api/club/not-a-club/settings", { as: alice });

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/club/:clubSlug/settings", () => {
  it("enables a feature and persists it", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post<ClubSettings>(`/api/club/${club.slug}/settings`, {
      body: { features: { awards: true } },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ features: { awards: true, discussionQuestions: false } });

    const reread = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });
    expect(reread.body.features.awards).toBe(true);
  });

  it("leaves the features it was not given alone", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { discussionQuestions: true },
    });

    const res = await api.post<ClubSettings>(`/api/club/${club.slug}/settings`, {
      body: { features: { awards: true } },
      as: alice,
    });

    expect(res.body).toEqual({ features: { awards: true, discussionQuestions: true } });
  });

  it("treats an empty body object as a no-op", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { awards: true },
    });

    const res = await api.post<ClubSettings>(`/api/club/${club.slug}/settings`, {
      body: {},
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ features: { awards: true, discussionQuestions: false } });
  });

  it.each([
    ["no body", undefined],
    ["a non-boolean feature flag", { features: { awards: "yes" } }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/settings`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();

    const res = await api.post(`/api/club/${club.slug}/settings`, {
      body: { features: { awards: true } },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
  });
});
