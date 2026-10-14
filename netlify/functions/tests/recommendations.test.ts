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
import { addReviewedWork, addWork, createClub, scoreWork, SeededClub } from "./helpers/factories";
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

  it("leaves out movies the club already has", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await reviewed(club, 1, [[alice, 9]]);
    await reviewed(club, 2, [[alice, 2]]);
    await addWork(club, alice, { externalId: "20", title: "Movie 20" });
    tmdbRecommends({ 1: [2, 20, 21] });

    const res = await recommendationsFor(club, alice);

    expect(titles(res.body)).toEqual(["Movie 21"]);
  });

  it("looks further down TMDB's list when the club already has the top of it", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await reviewed(club, 1, [[alice, 9]]);
    await reviewed(club, 2, [[alice, 2]]);
    const firstPage = Array.from({ length: 20 }, (_, index) => 100 + index);
    for (const id of firstPage) await addWork(club, alice, { externalId: String(id) });
    server.use(
      http.get(RECOMMENDATIONS, ({ params, request }) => {
        if (params.movieId !== "1") return HttpResponse.json(tmdbPage([]));
        const secondPage = new URL(request.url).searchParams.get("page") === "2";
        const ids = secondPage ? [200] : firstPage;
        return HttpResponse.json({
          ...tmdbPage(ids.map((id) => tmdbMovie(id))),
          page: secondPage ? 2 : 1,
          total_pages: 2,
        });
      }),
    );

    const res = await recommendationsFor(club, alice);

    expect(titles(res.body)).toEqual(["Movie 200"]);
  });

  it("ignores what members have scored in their other clubs", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const bobsOtherClub = await createClub(bob);
    await reviewed(bobsOtherClub, 3, [[bob, 9]]);
    await reviewed(bobsOtherClub, 4, [[bob, 2]]);
    failOnRequest("get", RECOMMENDATIONS);

    const res = await recommendationsFor(club, alice);

    expect(res.statusCode).toBe(200);
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

  it("recommends nothing, without asking TMDB, when the club has scored nothing", async () => {
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
