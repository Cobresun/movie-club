/**
 * Integration tests for `netlify/functions/club/awards/`.
 *
 * The awards data is a single JSON blob updated inside a `SELECT … FOR UPDATE`
 * transaction, so every route here is a read-modify-write — exactly the shape a
 * mocked repository cannot check. Each write is asserted by reading the year
 * back through `GET /awards/:year`, which is the only view a client has.
 */
import { describe, expect, it } from "vitest";

import { AwardsData, AwardsStep, ClubAwards } from "../../../lib/types/awards";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { createAwardsYear, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

const YEAR = 2024;

function awardsData(overrides: Partial<AwardsData> = {}): AwardsData {
  return { step: AwardsStep.Nominations, awards: [], ...overrides };
}

/** The year as a client sees it. */
const awardsOf = (club: SeededClub, year = YEAR) =>
  api.get<ClubAwards>(`/api/club/${club.slug}/awards/${year}`);

/** Categories, in order, as returned by the awards endpoint. */
async function categoryTitles(club: SeededClub) {
  const res = await awardsOf(club);
  return res.body.awards.map((award) => award.title);
}

describe("GET /api/club/:clubSlug/awards/years", () => {
  it("returns the club's award years, newest first", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, 2022, awardsData());
    await createAwardsYear(club, 2024, awardsData());
    await createAwardsYear(club, 2023, awardsData());

    const res = await api.get<number[]>(`/api/club/${club.slug}/awards/years`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([2024, 2023, 2022]);
  });

  it("returns an empty array for a club with no awards", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.get<number[]>(`/api/club/${club.slug}/awards/years`);

    expect(res.body).toEqual([]);
  });

  it("does not see another club's years", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createClub(alice);
    await createAwardsYear(other, 2024, awardsData());

    const res = await api.get<number[]>(`/api/club/${club.slug}/awards/years`);

    expect(res.body).toEqual([]);
  });
});

describe("GET /api/club/:clubSlug/awards/:year", () => {
  it("returns the year's awards with each nomination hydrated from TMDB", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        step: AwardsStep.Ratings,
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 27, nominatedBy: ["7"], ranking: {} }],
          },
        ],
      }),
    );

    const res = await awardsOf(club);

    expect(res.statusCode).toBe(200);
    expect(res.body.year).toBe(YEAR);
    expect(res.body.step).toBe(AwardsStep.Ratings);
    expect(res.body.awards[0].title).toBe("Best Picture");
    expect(res.body.awards[0].nominations[0]).toMatchObject({
      movieId: 27,
      movieTitle: "Movie 27",
      posterUrl: "https://image.tmdb.org/t/p/w154/poster-27.jpg",
    });
  });

  it("returns 404 for a year with no awards", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.get(`/api/club/${club.slug}/awards/1999`);

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for an unknown club", async () => {
    const res = await api.get(`/api/club/nope/awards/${YEAR}`);

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/club/:clubSlug/awards/:year/category", () => {
  it("appends a category with no nominations", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({ awards: [{ title: "Best Score", nominations: [] }] }),
    );

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { title: "Best Picture" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.awards.map((award) => award.title)).toEqual(["Best Score", "Best Picture"]);
    expect(awards.body.awards[1].nominations).toEqual([]);
  });

  it.each([
    ["no body", undefined],
    ["a body without a title", { name: "Best Picture" }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, YEAR, awardsData());

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual([]);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await createAwardsYear(club, YEAR, awardsData());

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { title: "Best Picture" },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
    expect(await categoryTitles(club)).toEqual([]);
  });
});

describe("PUT /api/club/:clubSlug/awards/:year/category", () => {
  it("reorders the categories to match the payload", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          { title: "A", nominations: [] },
          { title: "B", nominations: [] },
          { title: "C", nominations: [] },
        ],
      }),
    );

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { categories: ["C", "A", "B"] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(await categoryTitles(club)).toEqual(["C", "A", "B"]);
  });

  it("returns 500 and leaves the order alone when a title does not exist", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          { title: "A", nominations: [] },
          { title: "B", nominations: [] },
        ],
      }),
    );

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { categories: ["A", "Nonexistent"] },
      as: alice,
    });

    expect(res.statusCode).toBe(500);
    expect(await categoryTitles(club)).toEqual(["A", "B"]);
  });

  it.each([
    ["no body", undefined],
    ["categories that are not strings", { categories: [1, 2] }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, YEAR, awardsData());

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/club/:clubSlug/awards/:year/category/:awardTitle", () => {
  it("removes just that category", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          { title: "Keep", nominations: [] },
          { title: "Drop", nominations: [] },
        ],
      }),
    );

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/category/Drop`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(await categoryTitles(club)).toEqual(["Keep"]);
  });
});

describe("POST /api/club/:clubSlug/awards/:year/nomination", () => {
  it("creates a nomination for a movie nobody has nominated yet", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({ awards: [{ title: "Best Picture", nominations: [] }] }),
    );

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27, nominatedBy: alice.userId },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations).toHaveLength(1);
    expect(awards.body.awards[0].nominations[0]).toMatchObject({
      movieId: 27,
      nominatedBy: [alice.userId],
      ranking: {},
    });
  });

  it("adds a second nominator to an existing nomination", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 27, nominatedBy: ["99"], ranking: {} }],
          },
        ],
      }),
    );

    await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27, nominatedBy: alice.userId },
      as: alice,
    });

    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations).toHaveLength(1);
    expect(awards.body.awards[0].nominations[0].nominatedBy).toEqual(["99", alice.userId]);
  });

  it("leaves other categories untouched", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          { title: "Best Picture", nominations: [] },
          { title: "Best Score", nominations: [] },
        ],
      }),
    );

    await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27, nominatedBy: alice.userId },
      as: alice,
    });

    const awards = await awardsOf(club);
    expect(awards.body.awards[1].nominations).toEqual([]);
  });

  it.each([
    ["no body", undefined],
    [
      "a movieId that is not a number",
      { awardTitle: "Best Picture", movieId: "27", nominatedBy: "1" },
    ],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({ awards: [{ title: "Best Picture", nominations: [] }] }),
    );

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.awards[0].nominations).toEqual([]);
  });
});

describe("DELETE /api/club/:clubSlug/awards/:year/nomination/:movieId", () => {
  it("drops the user from nominatedBy but keeps the nomination for the others", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 27, nominatedBy: [alice.userId, "99"], ranking: {} }],
          },
        ],
      }),
    );

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture", userId: alice.userId },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations[0].nominatedBy).toEqual(["99"]);
  });

  it("removes the nomination entirely once its last nominator leaves", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 27, nominatedBy: [alice.userId], ranking: {} }],
          },
        ],
      }),
    );

    await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture", userId: alice.userId },
      as: alice,
    });

    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations).toEqual([]);
  });

  it.each([
    ["awardTitle", { userId: "1" }],
    ["userId", { awardTitle: "Best Picture" }],
  ])("returns 400 when the %s query parameter is missing", async (_label, query) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 27, nominatedBy: [alice.userId], ranking: {} }],
          },
        ],
      }),
    );

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.awards[0].nominations).toHaveLength(1);
  });
});

describe("POST /api/club/:clubSlug/awards/:year/ranking", () => {
  it("records the voter's ranking as the position of each movie", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [
              { movieId: 1, nominatedBy: ["9"], ranking: {} },
              { movieId: 2, nominatedBy: ["9"], ranking: {} },
              { movieId: 3, nominatedBy: ["9"], ranking: {} },
            ],
          },
        ],
      }),
    );

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body: { awardTitle: "Best Picture", movies: [3, 1], voter: alice.userId },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations.map((nomination) => nomination.ranking)).toEqual([
      { [alice.userId]: 2 },
      {},
      { [alice.userId]: 1 },
    ]);
  });

  it("keeps other voters' rankings", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(
      club,
      YEAR,
      awardsData({
        awards: [
          {
            title: "Best Picture",
            nominations: [{ movieId: 1, nominatedBy: ["9"], ranking: { "9": 1 } }],
          },
        ],
      }),
    );

    await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body: { awardTitle: "Best Picture", movies: [1], voter: alice.userId },
      as: alice,
    });

    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations[0].ranking).toEqual({ "9": 1, [alice.userId]: 1 });
  });

  it.each([
    ["no body", undefined],
    ["movies that are not numbers", { awardTitle: "Best Picture", movies: ["a"], voter: "1" }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, YEAR, awardsData());

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/awards/:year/step", () => {
  it("advances the awards to the given step", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, YEAR, awardsData({ step: AwardsStep.CategorySelect }));

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Presentation },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.Presentation);
  });

  it.each([
    ["no body", undefined],
    ["a step that is not a number", { step: "Presentation" }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, YEAR, awardsData({ step: AwardsStep.CategorySelect }));

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await createAwardsYear(club, YEAR, awardsData({ step: AwardsStep.CategorySelect }));

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Completed },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });
});
