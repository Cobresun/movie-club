/**
 * Integration tests for `netlify/functions/club/settings.ts` — the club feature
 * flags, stored as a JSON blob in `club_settings` and merged on write.
 */

import { type ClubSettings } from "../../../lib/types/club";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { createClub } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/club/:clubSlug/settings", () => {
  it("returns the club's stored feature flags", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { features: { awards: true } });

    const res = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({ features: { awards: true } });
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

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
    const club = await createClub(alice);

    const res = await api.post<ClubSettings>(`/api/club/${club.slug}/settings`, {
      body: { features: { awards: true } },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({ features: { awards: true } });

    const reread = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });
    expect(reread.body.features.awards).toBe(true);
  });

  it("treats an empty body object as a no-op", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { features: { awards: true } });

    const res = await api.post<ClubSettings>(`/api/club/${club.slug}/settings`, {
      body: {},
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({ features: { awards: true } });
  });

  it.each([
    ["no body", undefined],
    ["a non-boolean feature flag", { features: { awards: "yes" } }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/settings`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.post(`/api/club/${club.slug}/settings`, {
      body: { features: { awards: true } },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
    const settings = await api.get<ClubSettings>(`/api/club/${club.slug}/settings`, { as: alice });
    expect(settings.body.features.awards).toBe(false);
  });
});
