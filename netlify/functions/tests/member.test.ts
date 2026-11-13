/**
 * Integration tests for `netlify/functions/member.ts` — the signed-in user's
 * own profile: their clubs and display name. The avatar routes are tested in
 * `member-avatar.test.ts`.
 */
import { type ClubPreview, type Member } from "../../../lib/types/club";
import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { type MemberScoredWork } from "../../../lib/types/lists";
import { handler as clubHandler } from "../club/index";
import { handler } from "../member";
import { signIn, type TestSession } from "./helpers/auth";
import {
  addReviewedWork,
  createClub,
  joinClub,
  leaveClub,
  scoreWork,
  type SeededClub,
} from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);
const clubApi = requester(clubHandler);

/** The profile a club sees for `session` — how a client observes their name. */
async function profileIn(club: SeededClub, session: TestSession) {
  const members = await clubApi.get<Member[]>(`/api/club/${club.slug}/members`);
  return members.body.find((member) => member.id === session.userId);
}

describe("GET /api/member/clubs", () => {
  it("returns a preview of every club the user belongs to", async () => {
    const alice = await signIn("alice");
    const movies = await createClub(alice, { name: "Movie Night" });
    await createClub(alice, { name: "Books", type: ClubType.BOOK });
    await createClub(alice, { name: "Not Mine", members: [] });

    const res = await api.get<ClubPreview[]>("/api/member/clubs", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual({
      clubId: movies.id,
      clubName: "Movie Night",
      slug: movies.slug,
      type: ClubType.MOVIE,
    });
    expect(res.body.map((club) => club.clubName).sort()).toStrictEqual(["Books", "Movie Night"]);
  });

  it("returns an empty list for a user in no clubs", async () => {
    const bob = await signIn("bob");

    const res = await api.get<ClubPreview[]>("/api/member/clubs", { as: bob });

    expect(res.body).toStrictEqual([]);
  });

  it("returns 401 without a session", async () => {
    const res = await api.get("/api/member/clubs");

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/member/scores", () => {
  it("returns the member's own scores from every club they belong to", async () => {
    const alice = await signIn("alice");
    const movies = await createClub(alice, { name: "Movie Night" });
    const books = await createClub(alice, { name: "Books", type: ClubType.BOOK });
    const movie = await addReviewedWork(movies, alice, { title: "Heat", externalId: "77" });
    const book = await addReviewedWork(books, alice, {
      title: "Dune",
      type: WorkType.BOOK,
      externalId: "vol-1",
    });
    await scoreWork(movies, alice, movie.id, 8.5);
    await scoreWork(books, alice, book.id, 6);

    const res = await api.get<MemberScoredWork[]>("/api/member/scores", { as: alice });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body).toContainEqual(
      expect.objectContaining({
        workId: movie.id,
        clubName: "Movie Night",
        clubSlug: movies.slug,
        type: WorkType.MOVIE,
        title: "Heat",
        externalId: "77",
        score: 8.5,
      }),
    );
    expect(res.body).toContainEqual(
      expect.objectContaining({
        workId: book.id,
        clubName: "Books",
        type: WorkType.BOOK,
        score: 6,
      }),
    );
  });

  it("omits unscored works and other members' scores", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const scored = await addReviewedWork(club, alice, { externalId: null });
    const unscored = await addReviewedWork(club, alice, { externalId: null });
    await scoreWork(club, alice, scored.id, 7);
    await scoreWork(club, bob, unscored.id, 2);

    const res = await api.get<MemberScoredWork[]>("/api/member/scores", { as: alice });

    expect(res.body.map((work) => work.workId)).toStrictEqual([scored.id]);
  });

  it("drops scores left behind in a club the member has left", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await joinClub(club, bob);
    const work = await addReviewedWork(club, alice, { externalId: null });
    await scoreWork(club, bob, work.id, 9);
    await leaveClub(club, bob);

    const res = await api.get<MemberScoredWork[]>("/api/member/scores", { as: bob });

    expect(res.body).toStrictEqual([]);
  });

  it("returns 401 without a session", async () => {
    const res = await api.get("/api/member/scores");

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/member/name", () => {
  it("renames the signed-in user everywhere they appear", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put("/api/member/name", { body: { name: "  Alice B  " }, as: alice });

    expect(res.statusCode).toBe(200);
    await expect(profileIn(club, alice)).resolves.toMatchObject({ name: "Alice B" });
  });

  it.each([
    ["a name that is only whitespace", { name: "   " }, "Name cannot be empty"],
    ["a name over 100 characters", { name: "x".repeat(101) }, "Name is too long"],
  ])("returns 400 for %s", async (_label, body, message) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put<{ error: string }>("/api/member/name", { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(message);
    await expect(profileIn(club, alice)).resolves.toMatchObject({ name: "Alice" });
  });

  it("returns 401 without a session", async () => {
    const res = await api.put("/api/member/name", { body: { name: "Anon" } });

    expect(res.statusCode).toBe(401);
  });
});

describe("routing", () => {
  it("returns 404 for an unknown path", async () => {
    const res = await api.get("/api/member/unknown");

    expect(res.statusCode).toBe(404);
  });

  it("returns 405 for a method the route does not define", async () => {
    const res = await api.post("/api/member/clubs");

    expect(res.statusCode).toBe(405);
  });
});
