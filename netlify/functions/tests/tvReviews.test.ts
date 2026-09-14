/**
 * Integration tests for TV clubs: a score gesture on a show or one of its
 * seasons fans out to the episodes underneath it.
 *
 * TMDB is faked at the network boundary, so the provider's real address
 * parsing, season caching and episode expansion all run.
 */
import { describe, expect, it } from "vitest";

import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../lib/types/lists";
import { parseTvAddress, TvDataSummary } from "../../../lib/types/tv";
import { handler } from "../club/index";
import { TV_SEASON_EPISODE_COUNTS } from "./fixtures/external";
import { signIn, TestSession } from "./helpers/auth";
import { addWork, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

const SHOW_ID = "95396";

async function seedShow(club: SeededClub, session: TestSession) {
  return addWork(club, session, {
    listId: club.reviewsListId,
    type: WorkType.tv,
    externalId: SHOW_ID,
    title: "Severance",
  });
}

async function reviewsOf(club: SeededClub) {
  const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);
  expect(res.statusCode).toBe(200);
  return res.body;
}

/** The scored episodes on the reviews list, by address. */
function scoredEpisodes(reviews: DetailedReviewListItem[]) {
  return reviews
    .filter((review) => Object.keys(review.scores).length > 0)
    .map((review) => parseTvAddress(review.externalId))
    .filter((address) => address?.episodeNumber !== undefined);
}

describe("scoring a TV season", () => {
  it("writes the member's score to every episode TMDB lists for that season", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 8, seasonNumber: 1 },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const episodes = scoredEpisodes(await reviewsOf(club));
    expect(episodes).toHaveLength(TV_SEASON_EPISODE_COUNTS[1]);
    expect(episodes.every((address) => address?.seasonNumber === 1)).toBe(true);
  });

  it("scores the show's whole run, leaving TMDB's specials season alone", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 7 },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const episodes = scoredEpisodes(await reviewsOf(club));
    expect(episodes).toHaveLength(TV_SEASON_EPISODE_COUNTS[1] + TV_SEASON_EPISODE_COUNTS[2]);
    expect(episodes.some((address) => address?.seasonNumber === 0)).toBe(false);
  });

  it("replaces a score the member had set on one episode by hand", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 8, seasonNumber: 1 },
      as: alice,
    });
    const firstEpisode = (await reviewsOf(club)).find(
      (review) => parseTvAddress(review.externalId)?.episodeNumber === 1,
    );
    expect(firstEpisode).toBeDefined();

    await api.put(`/api/club/${club.slug}/reviews/${firstEpisode?.scores[alice.userId].id}`, {
      body: { score: 10 },
      as: alice,
    });
    await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 6, seasonNumber: 1 },
      as: alice,
    });

    const reviews = await reviewsOf(club);
    const scores = reviews
      .filter((review) => parseTvAddress(review.externalId)?.episodeNumber !== undefined)
      .map((review) => review.scores[alice.userId]?.score);
    expect(scores).toEqual(Array(TV_SEASON_EPISODE_COUNTS[1]).fill(6));
  });

  it("leaves another member's scores untouched when one member re-fills", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { type: ClubType.tv, members: [alice, bob] });
    const show = await seedShow(club, alice);

    await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 9, seasonNumber: 1 },
      as: bob,
    });
    await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 4, seasonNumber: 1 },
      as: alice,
    });

    const reviews = await reviewsOf(club);
    const episodes = reviews.filter(
      (review) => parseTvAddress(review.externalId)?.episodeNumber !== undefined,
    );
    expect(episodes.map((review) => review.scores[bob.userId]?.score)).toEqual(
      Array(TV_SEASON_EPISODE_COUNTS[1]).fill(9),
    );
    expect(episodes.map((review) => review.scores[alice.userId]?.score)).toEqual(
      Array(TV_SEASON_EPISODE_COUNTS[1]).fill(4),
    );
  });

  it("carries the show's season list so a club can open a season it has not scored", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    await seedShow(club, alice);

    const reviews = await reviewsOf(club);
    const showItem = reviews.find((review) => review.externalId === SHOW_ID);
    const data = showItem?.externalData as TvDataSummary | undefined;

    expect(data?.level).toBe("show");
    expect(data?.seasons?.map((season) => season.seasonNumber)).toEqual([1, 2]);
    expect(data?.seasons?.map((season) => season.episodeCount)).toEqual([
      TV_SEASON_EPISODE_COUNTS[1],
      TV_SEASON_EPISODE_COUNTS[2],
    ]);
  });

  it("scores one episode on its own without touching its siblings", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: show.id, score: 8, seasonNumber: 1 },
      as: alice,
    });
    const second = (await reviewsOf(club)).find(
      (review) => parseTvAddress(review.externalId)?.episodeNumber === 2,
    );

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: second?.id ?? "", score: 10 },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const reviews = await reviewsOf(club);
    const byEpisode = new Map(
      reviews
        .map((review) => [parseTvAddress(review.externalId)?.episodeNumber, review] as const)
        .filter(([episodeNumber]) => episodeNumber !== undefined),
    );
    expect(byEpisode.get(2)?.scores[alice.userId].score).toBe(10);
    expect(byEpisode.get(1)?.scores[alice.userId].score).toBe(8);
    expect(byEpisode.get(3)?.scores[alice.userId].score).toBe(8);
  });
});
