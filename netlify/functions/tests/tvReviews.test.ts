/**
 * Integration tests for TV clubs: the show, each season and each episode are
 * scored on their own, and a score at one level never writes to another.
 *
 * TMDB is faked at the network boundary, so the provider's real address
 * parsing, season caching and target resolution all run.
 */
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../lib/types/lists";
import { TvDataSummary } from "../../../lib/types/tv";
import { handler } from "../club/index";
import { TV_SEASON_EPISODE_COUNTS, tmdbTvSeason, tmdbTvShow } from "./fixtures/external";
import { signIn, TestSession } from "./helpers/auth";
import { addWork, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";
import { server, TMDB } from "./setup/externalApis";

const api = requester(handler);

const SHOW_ID = "95396";
const SEASON_1 = `${SHOW_ID}:1`;

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

async function scoreOf(club: SeededClub, externalId: string, session: TestSession) {
  const reviews = await reviewsOf(club);
  return reviews.find((review) => review.externalId === externalId)?.scores[session.userId]?.score;
}

async function score(
  club: SeededClub,
  session: TestSession,
  body: { workId: string; score: number; seasonNumber?: number; episodeNumber?: number },
) {
  return api.post(`/api/club/${club.slug}/reviews`, { body, as: session });
}

describe("scoring a TV show", () => {
  it("stores a season score on the season, without creating or scoring any episode", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await score(club, alice, { workId: show.id, score: 8, seasonNumber: 1 });

    expect(res.statusCode).toBe(200);
    const reviews = await reviewsOf(club);
    const season = reviews.find((review) => review.externalId === SEASON_1);
    expect(season?.title).toBe("Season 1");
    expect((season?.externalData as TvDataSummary | undefined)?.level).toBe("season");
    expect(season?.scores[alice.userId]?.score).toBe(8);
    expect(new Set(reviews.map((review) => review.externalId))).toEqual(
      new Set([SHOW_ID, SEASON_1]),
    );
  });

  it("leaves the member's episode scores alone when they score the season", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    await score(club, alice, { workId: show.id, score: 10, seasonNumber: 1, episodeNumber: 1 });
    await score(club, alice, { workId: show.id, score: 4, seasonNumber: 1 });

    expect(await scoreOf(club, `${SHOW_ID}:1:1`, alice)).toBe(10);
    expect(await scoreOf(club, SEASON_1, alice)).toBe(4);
  });

  it("leaves the season score alone when the member scores one of its episodes", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    await score(club, alice, { workId: show.id, score: 4, seasonNumber: 1 });
    await score(club, alice, { workId: show.id, score: 10, seasonNumber: 1, episodeNumber: 2 });

    expect(await scoreOf(club, SEASON_1, alice)).toBe(4);
    expect(await scoreOf(club, `${SHOW_ID}:1:2`, alice)).toBe(10);
  });

  it("stores a show score on the show itself, touching no season or episode", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);
    await score(club, alice, { workId: show.id, score: 9, seasonNumber: 1 });

    const res = await score(club, alice, { workId: show.id, score: 7 });

    expect(res.statusCode).toBe(200);
    expect(await scoreOf(club, SHOW_ID, alice)).toBe(7);
    expect(await scoreOf(club, SEASON_1, alice)).toBe(9);
  });

  it("replaces the member's season score when they score it again", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    await score(club, alice, { workId: show.id, score: 8, seasonNumber: 1 });
    await score(club, alice, { workId: show.id, score: 6, seasonNumber: 1 });

    expect(await scoreOf(club, SEASON_1, alice)).toBe(6);
  });

  it("scores a season through its own work once it exists", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);
    await score(club, alice, { workId: show.id, score: 8, seasonNumber: 1 });
    const season = (await reviewsOf(club)).find((review) => review.externalId === SEASON_1);

    const res = await score(club, alice, { workId: season?.id ?? "", score: 5 });

    expect(res.statusCode).toBe(200);
    expect(await scoreOf(club, SEASON_1, alice)).toBe(5);
  });

  it("leaves another member's season score untouched", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { type: ClubType.tv, members: [alice, bob] });
    const show = await seedShow(club, alice);

    await score(club, bob, { workId: show.id, score: 9, seasonNumber: 1 });
    await score(club, alice, { workId: show.id, score: 4, seasonNumber: 1 });

    expect(await scoreOf(club, SEASON_1, bob)).toBe(9);
    expect(await scoreOf(club, SEASON_1, alice)).toBe(4);
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

  it("scores one episode of a season the club has not opened yet", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await score(club, alice, {
      workId: show.id,
      score: 9,
      seasonNumber: 2,
      episodeNumber: 2,
    });

    expect(res.statusCode).toBe(200);
    const reviews = await reviewsOf(club);
    expect(new Set(reviews.map((review) => review.externalId))).toEqual(
      new Set([SHOW_ID, `${SHOW_ID}:2:2`]),
    );
    const episode = reviews.find((review) => review.externalId === `${SHOW_ID}:2:2`);
    expect(episode?.title).toBe(`Show ${SHOW_ID} S2E2`);
    expect(episode?.scores[alice.userId]?.score).toBe(9);
  });

  it("refuses an episode TMDB does not list, rather than scoring the show", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await score(club, alice, {
      workId: show.id,
      score: 9,
      seasonNumber: 1,
      episodeNumber: 99,
    });

    expect(res.statusCode).toBe(400);
    const reviews = await reviewsOf(club);
    expect(reviews.every((review) => Object.keys(review.scores).length === 0)).toBe(true);
  });

  it("refuses a season TMDB does not list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await score(club, alice, { workId: show.id, score: 9, seasonNumber: 9 });

    expect(res.statusCode).toBe(400);
    expect((await reviewsOf(club)).map((review) => review.externalId)).toEqual([SHOW_ID]);
  });

  it("refuses an episode of a season TMDB does not list, leaving no season behind", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const res = await score(club, alice, {
      workId: show.id,
      score: 9,
      seasonNumber: 9,
      episodeNumber: 1,
    });

    expect(res.statusCode).toBe(400);
    const showItem = (await reviewsOf(club)).find((review) => review.externalId === SHOW_ID);
    const data = showItem?.externalData as TvDataSummary | undefined;
    expect(data?.seasons?.map((season) => season.seasonNumber)).toEqual([1, 2]);
  });
});

describe("scoring what aired after it was cached", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Moves the clock past the window in which a cached listing is trusted. */
  function laterThatNight() {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 20 * 60 * 1000 });
  }

  it("scores an episode that aired after its season was cached", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);
    await score(club, alice, { workId: show.id, score: 8, seasonNumber: 1, episodeNumber: 1 });

    const cached = tmdbTvSeason(Number(SHOW_ID), 1);
    const newEpisodeNumber = (cached.episodes?.length ?? 0) + 1;
    server.use(
      http.get(`${TMDB}/tv/:showId/season/1`, () =>
        HttpResponse.json({
          ...cached,
          episodes: [
            ...(cached.episodes ?? []),
            {
              episode_number: newEpisodeNumber,
              season_number: 1,
              name: "Tonight's episode",
              still_path: null,
            },
          ],
        }),
      ),
    );
    laterThatNight();

    const res = await score(club, alice, {
      workId: show.id,
      score: 9,
      seasonNumber: 1,
      episodeNumber: newEpisodeNumber,
    });

    expect(res.statusCode).toBe(200);
    expect(await scoreOf(club, `${SHOW_ID}:1:${newEpisodeNumber}`, alice)).toBe(9);
  });

  it("scores a season announced after the show was cached", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);

    const cached = tmdbTvShow(Number(SHOW_ID));
    server.use(
      http.get(`${TMDB}/tv/:showId`, () =>
        HttpResponse.json({
          ...cached,
          number_of_seasons: 3,
          seasons: [
            ...(cached.seasons ?? []),
            { season_number: 3, name: "Season 3", poster_path: null, episode_count: 0 },
          ],
        }),
      ),
    );
    laterThatNight();

    const res = await score(club, alice, { workId: show.id, score: 7, seasonNumber: 3 });

    expect(res.statusCode).toBe(200);
    expect(await scoreOf(club, `${SHOW_ID}:3`, alice)).toBe(7);
  });
});

describe("removing a TV show", () => {
  it("takes the show's seasons and episodes off the reviews list with it", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);
    await score(club, alice, { workId: show.id, score: 8, seasonNumber: 1 });
    await score(club, alice, { workId: show.id, score: 9, seasonNumber: 1, episodeNumber: 2 });

    const res = await api.delete(
      `/api/club/${club.slug}/list/${club.reviewsListId}/items/${show.id}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(200);
    expect(await reviewsOf(club)).toEqual([]);
  });

  it("keeps another show's works when one is removed", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.tv });
    const show = await seedShow(club, alice);
    const other = await addWork(club, alice, {
      listId: club.reviewsListId,
      type: WorkType.tv,
      externalId: `${SHOW_ID}0`,
      title: "Another show",
    });
    await score(club, alice, { workId: other.id, score: 6, seasonNumber: 1 });

    await api.delete(`/api/club/${club.slug}/list/${club.reviewsListId}/items/${show.id}`, {
      as: alice,
    });

    expect(await scoreOf(club, `${SHOW_ID}0:1`, alice)).toBe(6);
  });
});
