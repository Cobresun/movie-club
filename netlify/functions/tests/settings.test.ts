/**
 * Integration tests for the club feature flags, stored as a JSON blob in
 * `club_settings`, merged on write (`netlify/functions/club/settings.ts`) and
 * read back on the club preview.
 */

import { type ClubPreview, type ClubSettings } from "../../../lib/types/club";
import { handler } from "../club/index";
import { handler as memberHandler } from "../member";
import { signIn } from "./helpers/auth";
import { createClub } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);
const memberApi = requester(memberHandler);

const settingsOf = async (slug: string) =>
  (await api.get<ClubPreview>(`/api/club/${slug}`)).body.settings;

describe("settings on the club preview", () => {
  it("carries the club's stored feature flags", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { features: { awards: true } });

    expect((await settingsOf(club.slug)).features.awards).toBe(true);
  });

  it("carries them on each club in the member's clubs list", async () => {
    const alice = await signIn("alice");
    const withAwards = await createClub(alice, { features: { awards: true } });
    const without = await createClub(alice);

    const clubs = await memberApi.get<ClubPreview[]>("/api/member/clubs", { as: alice });

    const awardsBySlug = Object.fromEntries(
      clubs.body.map((club) => [club.slug, club.settings.features.awards]),
    );
    expect(awardsBySlug).toStrictEqual({ [withAwards.slug]: true, [without.slug]: false });
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

    expect((await settingsOf(club.slug)).features.awards).toBe(true);
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
    expect((await settingsOf(club.slug)).features.awards).toBe(false);
  });
});
