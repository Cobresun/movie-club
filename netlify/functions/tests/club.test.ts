/**
 * Integration tests for `netlify/functions/club/index.ts`.
 *
 * Every layer below the HTTP boundary is real: the router, `validClubSlug`,
 * BetterAuth's `loggedIn` / `secured`, the repositories and CockroachDB. Only
 * TMDB is faked, and that at the network level (MSW).
 */
import { describe, expect, it } from "vitest";

import { ClubPreview, Member } from "../../../lib/types/club";
import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { DetailedMovieData } from "../../../lib/types/movie";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { addWork, createClub, setNextWork } from "./helpers/factories";
import { requester } from "./helpers/http";
import { requestsTo } from "./setup/externalApis";

const api = requester(handler);

interface ListSummary {
  id: string;
  title: string;
  systemType: string | null;
  itemCount: number;
}

interface ClubSettings {
  features: { awards: boolean; discussionQuestions: boolean };
}

describe("GET /api/club/:clubSlug", () => {
  it("returns the club preview", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { name: "Film Buffs" });

    const res = await api.get<ClubPreview>(`/api/club/${club.slug}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      clubId: club.id,
      clubName: "Film Buffs",
      slug: club.slug,
      type: ClubType.movie,
    });
  });

  it("reports the club type for a book club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.book });

    const res = await api.get<ClubPreview>(`/api/club/${club.slug}`);

    expect(res.body.type).toBe(ClubType.book);
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await api.get("/api/club/nobody-here");

    expect(res.statusCode).toBe(404);
  });

  it("returns 405 for a method the route does not define", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}`);

    expect(res.statusCode).toBe(405);
  });
});

describe("POST /api/club", () => {
  it("creates a club reachable at a slug derived from its name", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ clubId: string; slug: string }>("/api/club", {
      body: { name: "The Late Night Crew", members: [alice.email] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe("the-late-night-crew");

    const club = await api.get<ClubPreview>("/api/club/the-late-night-crew");
    expect(club.body).toMatchObject({
      clubId: res.body.clubId,
      clubName: "The Late Night Crew",
      type: ClubType.movie,
    });
    // Left unset on creation so a brand-new club can still change its URL.
    expect(club.body.slugUpdatedAt).toBeUndefined();
  });

  it("gives the new club one user list and a reviews list it keeps hidden", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "List Club", members: [alice.email] },
      as: alice,
    });

    const lists = await api.get<ListSummary[]>(`/api/club/${res.body.slug}/list`);
    expect(lists.body).toEqual([
      { id: expect.any(String), title: "Watch List", systemType: null, itemCount: 0 },
    ]);

    const reviews = await api.get<{ id: string }>(`/api/club/${res.body.slug}/list/reviews-id`, {
      as: alice,
    });
    expect(reviews.statusCode).toBe(200);
    expect(reviews.body.id).not.toBe(lists.body[0].id);
  });

  it("names the default list for the club's media type", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "Book Club", members: [alice.email], type: ClubType.book },
      as: alice,
    });

    const lists = await api.get<ListSummary[]>(`/api/club/${res.body.slug}/list`);
    expect(lists.body[0].title).toBe("Reading List");
  });

  it("seeds default settings with every feature off", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "Settings Club", members: [alice.email] },
      as: alice,
    });

    const settings = await api.get<ClubSettings>(`/api/club/${res.body.slug}/settings`, {
      as: alice,
    });
    expect(settings.body).toEqual({ features: { awards: false, discussionQuestions: false } });
  });

  it("adds the listed members, making the first one an admin", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "Crew", members: [alice.email, bob.email] },
      as: alice,
    });

    const members = await api.get<Member[]>(`/api/club/${res.body.slug}/members`);
    expect(members.body).toHaveLength(2);
    expect(members.body).toContainEqual(
      expect.objectContaining({ id: alice.userId, name: "Alice", role: "admin" }),
    );
    expect(members.body).toContainEqual(
      expect.objectContaining({ id: bob.userId, name: "Bob", role: "member" }),
    );
  });

  it("appends a suffix when the derived slug is taken", async () => {
    const alice = await signIn("alice");
    await createClub(alice, { name: "Duplicate" });

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "Duplicate", members: [alice.email] },
      as: alice,
    });

    expect(res.body.slug).toMatch(/^duplicate-[0-9a-f]{6}$/);
    expect((await api.get(`/api/club/${res.body.slug}`)).statusCode).toBe(200);
  });

  it("reports failure but still creates the club when a member email is unknown", async () => {
    const alice = await signIn("alice");

    const res = await api.post("/api/club", {
      body: { name: "Ghost Club", members: ["nobody@movie.club"] },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    const club = await api.get<ClubPreview>("/api/club/ghost-club");
    expect(club.statusCode).toBe(200);
    expect(club.body.clubName).toBe("Ghost Club");
  });

  it("returns 401 when the request has no session", async () => {
    const res = await api.post("/api/club", { body: { name: "Anon Club", members: [] } });

    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the session cookie is not a real session", async () => {
    const res = await api.post("/api/club", {
      body: { name: "Forged", members: [] },
      headers: { cookie: "better-auth.session_token=not-a-real-token" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");

    const res = await api.post("/api/club", { as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when the body does not match the schema", async () => {
    const alice = await signIn("alice");

    const res = await api.post("/api/club", { body: { invalid: "data" }, as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/name", () => {
  it("renames the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { name: "Old Name" });

    const res = await api.put(`/api/club/${club.slug}/name`, {
      body: { name: "New Name" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const after = await api.get<ClubPreview>(`/api/club/${club.slug}`);
    expect(after.body.clubName).toBe("New Name");
  });

  it("returns 401 for a signed-in user who is not a member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { name: "Members Only", members: [alice] });

    const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "Hi" }, as: bob });

    expect(res.statusCode).toBe(401);
    const after = await api.get<ClubPreview>(`/api/club/${club.slug}`);
    expect(after.body.clubName).toBe("Members Only");
  });

  it("returns 400 for an empty name", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "" }, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/name`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/slug", () => {
  it("moves the club to the new url and records when it changed", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put<{ slug: string }>(`/api/club/${club.slug}/slug`, {
      body: { slug: "new-slug" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe("new-slug");

    const moved = await api.get<ClubPreview>("/api/club/new-slug");
    expect(moved.statusCode).toBe(200);
    expect(moved.body.slugUpdatedAt).toEqual(expect.any(String));
    expect((await api.get(`/api/club/${club.slug}`)).statusCode).toBe(404);
  });

  it("returns 400 when another club already uses the slug", async () => {
    const alice = await signIn("alice");
    await createClub(alice, { name: "Taken Slug" });
    const club = await createClub(alice);

    const res = await api.put<{ error: string }>(`/api/club/${club.slug}/slug`, {
      body: { slug: "taken-slug" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This url is already in use by another club");
  });

  it("allows a club to re-save its own slug", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/slug`, {
      body: { slug: club.slug },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
  });

  it.each([
    ["uppercase and spaces", "INVALID SLUG"],
    ["a leading hyphen", "-leading"],
    ["fewer than three characters", "ab"],
    ["a reserved word", "settings"],
  ])("returns 400 for a slug with %s", async (_label, slug) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/slug`, { body: { slug }, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.put(`/api/club/${club.slug}/slug`, { body: { slug: "mine" }, as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("/api/club/:clubSlug/nextWork", () => {
  it("returns the club's next work", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { title: "Up Next" });
    await setNextWork(club, alice, work.id);

    const res = await api.get<{ workId: string }>(`/api/club/${club.slug}/nextWork`);

    expect(res.statusCode).toBe(200);
    expect(res.body.workId).toBe(work.id);
  });

  it("returns an empty payload when nothing is queued", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.get<{ workId?: string }>(`/api/club/${club.slug}/nextWork`);

    expect(res.statusCode).toBe(200);
    expect(res.body.workId).toBeUndefined();
  });

  it("replaces the previous next work rather than adding a second one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const first = await addWork(club, alice);
    const second = await addWork(club, alice);
    await setNextWork(club, alice, first.id);

    const res = await api.put(`/api/club/${club.slug}/nextWork`, {
      body: { workId: second.id },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const after = await api.get<{ workId: string }>(`/api/club/${club.slug}/nextWork`);
    expect(after.body.workId).toBe(second.id);
  });

  it("clears the next work", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice);
    await setNextWork(club, alice, work.id);

    const res = await api.delete(`/api/club/${club.slug}/nextWork`, { as: alice });

    expect(res.statusCode).toBe(200);
    const after = await api.get<{ workId?: string }>(`/api/club/${club.slug}/nextWork`);
    expect(after.body.workId).toBeUndefined();
  });

  it("returns 401 when a non-member sets the next work", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    const work = await addWork(club, alice);

    const res = await api.put(`/api/club/${club.slug}/nextWork`, {
      body: { workId: work.id },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/nextWork`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/work/:workId/details", () => {
  it("returns the work's cached metadata including its full cast", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { title: "Fight Club", externalId: "550" });

    const res = await api.get<DetailedMovieData>(`/api/club/${club.slug}/work/${work.id}/details`);

    expect(res.statusCode).toBe(200);
    expect(res.body.kind).toBe("movie");
    expect(res.body.overview).toBe("Overview for movie 550");
    expect(res.body.directors).toEqual([
      { name: "Director 550", profilePath: "/director-550.jpg" },
    ]);
    expect(res.body.actors).toEqual([
      { name: "Lead 550", character: "Hero 550", profilePath: "/lead-550.jpg" },
      { name: "Support 550", character: "Sidekick 550", profilePath: null },
    ]);
    // Adding the work cached the details; reading them makes no further call.
    expect(requestsTo("api.themoviedb.org/3/movie/550")).toHaveLength(1);
  });

  it("returns null for a work with no external id", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.get(`/api/club/${club.slug}/work/${work.id}/details`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns 404 for a work belonging to another club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const otherClub = await createClub(alice);
    const work = await addWork(otherClub, alice, { type: WorkType.movie });

    const res = await api.get(`/api/club/${club.slug}/work/${work.id}/details`);

    expect(res.statusCode).toBe(404);
  });
});
