/**
 * Integration tests for `netlify/functions/club/recommendations.ts`.
 *
 * Scores are written through the real review endpoints and read back through
 * the real repositories; only TMDB's recommendations are faked, as a graph of
 * which movie ids TMDB says resemble which.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { WorkRecommendation } from "../../../lib/types/recommendations";
import { handler } from "../club/index";
import { tmdbMovie, tmdbPage } from "./fixtures/external";
import { signIn, TestSession } from "./helpers/auth";
import {
  addReviewedWork,
  addWork,
  createClub,
  leaveClub,
  scoreWork,
  SeededClub,
} from "./helpers/factories";
import { requester } from "./helpers/http";
import { failOnRequest, server, TMDB } from "./setup/externalApis";

const api = requester(handler);

const RECOMMENDATIONS = `${TMDB}/movie/:movieId/recommendations`;

/** Which movies TMDB recommends for each movie id, most relevant first. */
function tmdbRecommends(graph: Record<number, number[]>) {
  server.use(
    http.get(RECOMMENDATIONS, ({ params }) =>
      HttpResponse.json(tmdbPage((graph[Number(params.movieId)] ?? []).map((id) => tmdbMovie(id)))),
    ),
  );
}

/** Put a movie on the club's reviews list and record each member's score for it. */
async function reviewed(club: SeededClub, movieId: number, scores: [TestSession, number][]) {
  const work = await addReviewedWork(club, scores[0][0], {
    externalId: String(movieId),
    title: `Movie ${movieId}`,
  });
  for (const [member, value] of scores) await scoreWork(club, member, work.id, value);
}

const recommendationsFor = (club: SeededClub, as: TestSession) =>
  api.get<WorkRecommendation[]>(`/api/club/${club.slug}/recommendations`, { as });

const titles = (recommendations: WorkRecommendation[]) => recommendations.map((r) => r.title);

describe("GET /api/club/:clubSlug/recommendations", () => {
  it("recommends movies like the ones the club scored highly", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    await reviewed(club, 1, [
      [alice, 9],
      [bob, 9],
    ]);
    await reviewed(club, 2, [
      [alice, 2],
      [bob, 3],
    ]);
    tmdbRecommends({ 1: [10, 11], 2: [12] });

    const res = await recommendationsFor(club, alice);

    expect(res.statusCode).toBe(200);
    expect(titles(res.body)).toEqual(["Movie 10", "Movie 11"]);
    expect(res.body[0]).toEqual({
      externalId: "10",
      title: "Movie 10",
      subtitle: "2001",
      imageUrl: "https://image.tmdb.org/t/p/w154/poster-10.jpg",
      similarTo: ["Movie 1"],
    });
  });

  it("ranks movies that resemble one the club disliked below those that don't", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    await reviewed(club, 1, [
      [alice, 9],
      [bob, 9],
    ]);
    await reviewed(club, 2, [
      [alice, 2],
      [bob, 3],
    ]);
    tmdbRecommends({ 1: [10, 11], 2: [10] });

    const res = await recommendationsFor(club, alice);

    expect(titles(res.body)).toEqual(["Movie 11", "Movie 10"]);
  });

  it("leaves out movies the club already has or a member has already scored", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    await reviewed(club, 1, [[alice, 9]]);
    await reviewed(club, 2, [[alice, 2]]);
    await addWork(club, alice, { externalId: "20", title: "Movie 20" });
    const bobsOtherClub = await createClub(bob);
    await reviewed(bobsOtherClub, 21, [[bob, 6]]);
    tmdbRecommends({ 1: [20, 21, 22] });

    const res = await recommendationsFor(club, alice);

    expect(titles(res.body)).toEqual(["Movie 22"]);
  });

  it("draws on members' scores from their other clubs, naming only what the viewer can see", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const alicesOtherClub = await createClub(alice);
    await reviewed(alicesOtherClub, 1, [[alice, 9]]);
    await reviewed(alicesOtherClub, 2, [[alice, 2]]);
    const bobsOtherClub = await createClub(bob);
    await reviewed(bobsOtherClub, 3, [[bob, 9]]);
    await reviewed(bobsOtherClub, 4, [[bob, 2]]);
    tmdbRecommends({ 1: [10], 3: [30] });

    const asAlice = await recommendationsFor(club, alice);
    const asBob = await recommendationsFor(club, bob);

    const reasons = (recommendations: WorkRecommendation[]) =>
      Object.fromEntries(recommendations.map((r) => [r.title, r.similarTo]));
    expect(reasons(asAlice.body)).toEqual({ "Movie 10": ["Movie 1"], "Movie 30": [] });
    expect(reasons(asBob.body)).toEqual({ "Movie 10": [], "Movie 30": ["Movie 3"] });
  });

  it("ignores scores from a club the member has since left", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const bobsOldClub = await createClub(bob);
    await reviewed(bobsOldClub, 3, [[bob, 9]]);
    await reviewed(bobsOldClub, 4, [[bob, 2]]);
    await leaveClub(bobsOldClub, bob);
    tmdbRecommends({ 3: [30] });

    const res = await recommendationsFor(club, alice);

    expect(res.body).toEqual([]);
  });

  it("still recommends when TMDB fails for one of the movies it starts from", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await reviewed(club, 1, [[alice, 9]]);
    await reviewed(club, 2, [[alice, 9]]);
    await reviewed(club, 3, [[alice, 2]]);
    server.use(
      http.get(RECOMMENDATIONS, ({ params }) =>
        params.movieId === "1"
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(tmdbPage(params.movieId === "2" ? [tmdbMovie(20)] : [])),
      ),
    );

    const res = await recommendationsFor(club, alice);

    expect(res.statusCode).toBe(200);
    expect(titles(res.body)).toEqual(["Movie 20"]);
  });

  it("recommends nothing, without asking TMDB, when no member has scored anything", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { externalId: "20" });
    failOnRequest("get", RECOMMENDATIONS);

    const res = await recommendationsFor(club, alice);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("is only for the club's members", async () => {
    const alice = await signIn("alice");
    const carol = await signIn("carol");
    const club = await createClub(alice);

    const res = await recommendationsFor(club, carol);

    expect(res.statusCode).toBe(401);
  });
});
