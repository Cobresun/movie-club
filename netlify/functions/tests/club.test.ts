/**
 * Integration tests for `netlify/functions/club/index.ts`.
 *
 * Every layer below the HTTP boundary is real: the router, `validClubSlug`,
 * BetterAuth's `loggedIn` / `secured`, the repositories and CockroachDB. Only
 * TMDB is faked, and that at the network level (MSW).
 */
import { describe, expect, it } from "vitest";

import { ClubPreview } from "../../../lib/types/club";
import { ClubType, WorkListSystemType, WorkType } from "../../../lib/types/generated/db";
import { DetailedMovieData } from "../../../lib/types/movie";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import {
  addToList,
  cacheMovieDetails,
  createClub,
  createNextWork,
  createUser,
  createWork,
} from "./helpers/factories";
import { requester } from "./helpers/http";
import { requestsTo } from "./setup/externalApis";

const api = requester(handler);

describe("GET /api/club/:clubSlug", () => {
  it("returns the club preview", async () => {
    const club = await createClub({ name: "Film Buffs", slug: "film-buffs" });

    const res = await api.get<ClubPreview>("/api/club/film-buffs");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      clubId: club.id,
      clubName: "Film Buffs",
      slug: "film-buffs",
      type: ClubType.movie,
    });
  });

  it("reports the club type for a book club", async () => {
    await createClub({ slug: "page-turners", type: ClubType.book });

    const res = await api.get<ClubPreview>("/api/club/page-turners");

    expect(res.body.type).toBe(ClubType.book);
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await api.get("/api/club/nobody-here");

    expect(res.statusCode).toBe(404);
  });

  it("returns 405 for a method the route does not define", async () => {
    const club = await createClub();

    const res = await api.post(`/api/club/${club.slug}`);

    expect(res.statusCode).toBe(405);
  });
});

describe("POST /api/club", () => {
  it("creates a club with a slug derived from its name", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ clubId: string; slug: string }>("/api/club", {
      body: { name: "The Late Night Crew", members: [] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe("the-late-night-crew");

    const club = await db
      .selectFrom("club")
      .selectAll()
      .where("id", "=", res.body.clubId)
      .executeTakeFirstOrThrow();
    expect(club.name).toBe("The Late Night Crew");
    // Left null on creation so a brand-new club can still change its URL.
    expect(club.slug_updated_at).toBeNull();
  });

  it("gives the new club a default user list and a reviews system list", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ clubId: string }>("/api/club", {
      body: { name: "List Club", members: [] },
      as: alice,
    });

    const lists = await db
      .selectFrom("work_list")
      .select(["title", "system_type"])
      .where("club_id", "=", res.body.clubId)
      .orderBy("position", "asc")
      .execute();

    expect(lists).toEqual([
      { title: "Watch List", system_type: null },
      { title: "Reviews", system_type: WorkListSystemType.reviews },
    ]);
  });

  it("names the default list for the club's media type", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ clubId: string }>("/api/club", {
      body: { name: "Book Club", members: [], type: ClubType.book },
      as: alice,
    });

    const list = await db
      .selectFrom("work_list")
      .select("title")
      .where("club_id", "=", res.body.clubId)
      .where("system_type", "is", null)
      .executeTakeFirstOrThrow();

    expect(list.title).toBe("Reading List");
  });

  it("seeds default settings with every feature off", async () => {
    const alice = await signIn("alice");

    const res = await api.post<{ clubId: string }>("/api/club", {
      body: { name: "Settings Club", members: [] },
      as: alice,
    });

    const settings = await db
      .selectFrom("club_settings")
      .select("value")
      .where("club_id", "=", res.body.clubId)
      .where("key", "=", "features")
      .executeTakeFirstOrThrow();

    expect(settings.value).toEqual({ features: { awards: false, discussionQuestions: false } });
  });

  it("adds the listed members, making the first one an admin", async () => {
    const alice = await signIn("alice");
    const second = await createUser({ name: "Second" });

    const res = await api.post<{ clubId: string }>("/api/club", {
      body: { name: "Crew", members: [alice.email, second.email] },
      as: alice,
    });

    const members = await db
      .selectFrom("club_member")
      .innerJoin("user", "user.id", "club_member.user_id")
      .select(["user.name", "club_member.role"])
      .where("club_member.club_id", "=", res.body.clubId)
      .orderBy("club_member.role", "asc")
      .execute();

    expect(members).toEqual([
      { name: "Alice", role: "admin" },
      { name: "Second", role: "member" },
    ]);
  });

  it("appends a suffix when the derived slug is taken", async () => {
    const alice = await signIn("alice");
    await createClub({ name: "Duplicate", slug: "duplicate" });

    const res = await api.post<{ slug: string }>("/api/club", {
      body: { name: "Duplicate", members: [] },
      as: alice,
    });

    expect(res.body.slug).not.toBe("duplicate");
    expect(res.body.slug).toMatch(/^duplicate-[0-9a-f]{6}$/);
  });

  it("reports failure but still creates the club when a member email is unknown", async () => {
    const alice = await signIn("alice");

    const res = await api.post("/api/club", {
      body: { name: "Ghost Club", members: ["nobody@movie.club"] },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    const club = await db
      .selectFrom("club")
      .select("id")
      .where("name", "=", "Ghost Club")
      .executeTakeFirst();
    expect(club).toBeDefined();
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
    const club = await createClub({ name: "Old Name", members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/name`, {
      body: { name: "New Name" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const row = await db
      .selectFrom("club")
      .select("name")
      .where("id", "=", club.id)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("New Name");
  });

  it("returns 401 for a signed-in user who is not a member", async () => {
    const bob = await signIn("bob");
    const club = await createClub({ name: "Members Only" });

    const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "Hi" }, as: bob });

    expect(res.statusCode).toBe(401);
    const row = await db
      .selectFrom("club")
      .select("name")
      .where("id", "=", club.id)
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Members Only");
  });

  it("returns 400 for an empty name", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/name`, { body: { name: "" }, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/name`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/slug", () => {
  it("changes the slug and stamps slug_updated_at", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ slug: "old-slug", members: [{ userId: alice.userId }] });

    const res = await api.put<{ slug: string }>(`/api/club/${club.slug}/slug`, {
      body: { slug: "new-slug" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.slug).toBe("new-slug");

    const row = await db
      .selectFrom("club")
      .select(["slug", "slug_updated_at"])
      .where("id", "=", club.id)
      .executeTakeFirstOrThrow();
    expect(row.slug).toBe("new-slug");
    expect(row.slug_updated_at).toBeInstanceOf(Date);

    // The club is reachable under its new URL, and not the old one.
    expect((await api.get("/api/club/new-slug")).statusCode).toBe(200);
    expect((await api.get("/api/club/old-slug")).statusCode).toBe(404);
  });

  it("returns 400 when another club already uses the slug", async () => {
    const alice = await signIn("alice");
    await createClub({ slug: "taken-slug" });
    const club = await createClub({ slug: "my-slug", members: [{ userId: alice.userId }] });

    const res = await api.put<{ error: string }>(`/api/club/${club.slug}/slug`, {
      body: { slug: "taken-slug" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This url is already in use by another club");
  });

  it("allows a club to re-save its own slug", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ slug: "same-slug", members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/slug`, {
      body: { slug: "same-slug" },
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
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/slug`, { body: { slug }, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub({ slug: "not-yours" });

    const res = await api.put(`/api/club/${club.slug}/slug`, { body: { slug: "mine" }, as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("/api/club/:clubSlug/nextWork", () => {
  it("returns the club's next work", async () => {
    const club = await createClub();
    const work = await createWork(club.id, { title: "Up Next" });
    await createNextWork(club.id, work.id);

    const res = await api.get<{ workId: string }>(`/api/club/${club.slug}/nextWork`);

    expect(res.statusCode).toBe(200);
    expect(res.body.workId).toBe(work.id);
  });

  it("returns an empty payload when nothing is queued", async () => {
    const club = await createClub();

    const res = await api.get<{ workId?: string }>(`/api/club/${club.slug}/nextWork`);

    expect(res.statusCode).toBe(200);
    expect(res.body.workId).toBeUndefined();
  });

  it("replaces the previous next work rather than adding a second one", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const first = await createWork(club.id);
    const second = await createWork(club.id);
    await createNextWork(club.id, first.id);

    const res = await api.put(`/api/club/${club.slug}/nextWork`, {
      body: { workId: second.id },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const rows = await db
      .selectFrom("next_work")
      .select("work_id")
      .where("club_id", "=", club.id)
      .execute();
    expect(rows).toEqual([{ work_id: second.id }]);
  });

  it("clears the next work", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id);
    await createNextWork(club.id, work.id);

    const res = await api.delete(`/api/club/${club.slug}/nextWork`, { as: alice });

    expect(res.statusCode).toBe(200);
    const after = await api.get<{ workId?: string }>(`/api/club/${club.slug}/nextWork`);
    expect(after.body.workId).toBeUndefined();
  });

  it("returns 401 when a non-member sets the next work", async () => {
    const bob = await signIn("bob");
    const club = await createClub();
    const work = await createWork(club.id);

    const res = await api.put(`/api/club/${club.slug}/nextWork`, {
      body: { workId: work.id },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/nextWork`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/work/:workId/details", () => {
  it("returns the work's cached metadata including its full cast", async () => {
    const club = await createClub();
    await cacheMovieDetails("550");
    const work = await createWork(club.id, { externalId: "550", title: "Fight Club" });
    await addToList(club.listId, work.id);

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
    // Details come out of the cache — no TMDB round trip on read.
    expect(requestsTo("api.themoviedb.org")).toHaveLength(0);
  });

  it("returns null for a work with no external id", async () => {
    const club = await createClub();
    const work = await createWork(club.id, { externalId: null });

    const res = await api.get(`/api/club/${club.slug}/work/${work.id}/details`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeNull();
  });

  it("returns 404 for a work belonging to another club", async () => {
    const club = await createClub();
    const otherClub = await createClub();
    const work = await createWork(otherClub.id, { type: WorkType.movie });

    const res = await api.get(`/api/club/${club.slug}/work/${work.id}/details`);

    expect(res.statusCode).toBe(404);
  });
});
