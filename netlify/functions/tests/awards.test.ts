/**
 * Integration tests for `netlify/functions/club/awards/`.
 *
 * The awards data is a single JSON blob updated inside a `SELECT … FOR UPDATE`
 * transaction, so every route here is a read-modify-write — exactly the shape a
 * mocked repository cannot check. Each write is asserted by reading the year
 * back through `GET /awards/:year`, which is the only view a client has.
 */
import { describe, expect, it } from "vitest";

import { AwardsStep, ClubAwards } from "../../../lib/types/awards";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import {
  createAwardsYear,
  createClub,
  nominate,
  rankAward,
  SeededClub,
  setAwardsStep,
} from "./helpers/factories";
import { requester } from "./helpers/http";

const api = requester(handler);

const YEAR = 2024;

/** The year as a client sees it. */
const awardsOf = (club: SeededClub, year = YEAR) =>
  api.get<ClubAwards>(`/api/club/${club.slug}/awards/${year}`);

/** Categories, in order, as returned by the awards endpoint. */
async function categoryTitles(club: SeededClub) {
  const res = await awardsOf(club);
  return res.body.awards.map((award) => award.title);
}

/** Each nominee of the first category as `movieId → nominatedBy`. */
async function nominees(club: SeededClub) {
  const res = await awardsOf(club);
  return Object.fromEntries(
    res.body.awards[0].nominations.map((nomination) => [
      nomination.movieId,
      nomination.nominatedBy,
    ]),
  );
}

async function clubWithTwoMembers() {
  const alice = await signIn("alice");
  const bob = await signIn("bob");
  const club = await createClub(alice, { members: [alice, bob] });
  return { alice, bob, club };
}

describe("GET /api/club/:clubSlug/awards/years", () => {
  it("returns the club's award years, newest first", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, 2022);
    await createAwardsYear(club, alice, 2024);
    await createAwardsYear(club, alice, 2023);

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
    await createAwardsYear(other, alice, 2024);

    const res = await api.get<number[]>(`/api/club/${club.slug}/awards/years`);

    expect(res.body).toEqual([]);
  });
});

describe("POST /api/club/:clubSlug/awards", () => {
  it("opens the year on the categories step with the categories it was given", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/awards`, {
      body: { year: YEAR, categories: ["Best Picture", "  Funniest Movie "] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.step).toBe(AwardsStep.CategorySelect);
    expect(awards.body.awards).toEqual([
      { title: "Best Picture", nominations: [] },
      { title: "Funniest Movie", nominations: [] },
    ]);
  });

  it("refuses a year the club already has, leaving it untouched", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.post(`/api/club/${club.slug}/awards`, {
      body: { year: YEAR, categories: [] },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual(["Best Picture"]);
  });

  it.each([
    ["no body", undefined],
    ["a year out of range", { year: 24, categories: [] }],
    ["a blank category", { year: YEAR, categories: [" "] }],
    ["the same category twice", { year: YEAR, categories: ["Best Score", "best score"] }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/awards`, { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect((await api.get<number[]>(`/api/club/${club.slug}/awards/years`)).body).toEqual([]);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.post(`/api/club/${club.slug}/awards`, {
      body: { year: YEAR, categories: [] },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
    expect((await api.get<number[]>(`/api/club/${club.slug}/awards/years`)).body).toEqual([]);
  });
});

describe("DELETE /api/club/:clubSlug/awards/:year", () => {
  it("removes just that year", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, 2023);
    await createAwardsYear(club, alice, 2024);

    const res = await api.delete(`/api/club/${club.slug}/awards/2024`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect((await api.get<number[]>(`/api/club/${club.slug}/awards/years`)).body).toEqual([2023]);
  });

  it("returns 404 for a year the club does not have", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.delete(`/api/club/${club.slug}/awards/1999`, { as: alice });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await createAwardsYear(club, alice, YEAR);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}`, { as: bob });

    expect(res.statusCode).toBe(401);
    expect((await api.get<number[]>(`/api/club/${club.slug}/awards/years`)).body).toEqual([YEAR]);
  });
});

describe("GET /api/club/:clubSlug/awards/:year", () => {
  it("returns the year's awards with each nomination hydrated from TMDB", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);

    const res = await awardsOf(club);

    expect(res.statusCode).toBe(200);
    expect(res.body.year).toBe(YEAR);
    expect(res.body.step).toBe(AwardsStep.Nominations);
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
    await createAwardsYear(club, alice, YEAR, ["Best Score"]);

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
    ["a blank title", { title: "   " }],
    ["a title that is already a category", { title: "best score" }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Score"]);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual(["Best Score"]);
  });

  it("returns 400 once nominations are open", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Score"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { title: "Best Picture" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual(["Best Score"]);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await createAwardsYear(club, alice, YEAR);

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
    await createAwardsYear(club, alice, YEAR, ["A", "B", "C"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { categories: ["C", "A", "B"] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(await categoryTitles(club)).toEqual(["C", "A", "B"]);
  });

  it.each([
    ["names a category that does not exist", ["A", "Nonexistent"]],
    ["leaves a category out", ["B"]],
    ["repeats a category", ["A", "A"]],
  ])("returns 400 and leaves the order alone when the payload %s", async (_label, categories) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["A", "B"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/category`, {
      body: { categories },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual(["A", "B"]);
  });

  it.each([
    ["no body", undefined],
    ["categories that are not strings", { categories: [1, 2] }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR);

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
    await createAwardsYear(club, alice, YEAR, ["Keep", "Drop"]);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/category/Drop`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(await categoryTitles(club)).toEqual(["Keep"]);
  });

  it("returns 400 once nominations are open", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Keep", "Drop"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/category/Drop`, {
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await categoryTitles(club)).toEqual(["Keep", "Drop"]);
  });
});

describe("POST /api/club/:clubSlug/awards/:year/nomination", () => {
  it("creates a nomination attributed to the signed-in member", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27 },
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
    const { alice, bob, club } = await clubWithTwoMembers();
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, bob, YEAR, "Best Picture", 27);

    await nominate(club, alice, YEAR, "Best Picture", 27);

    expect(await nominees(club)).toEqual({ 27: [bob.userId, alice.userId] });
  });

  it("leaves other categories untouched", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture", "Best Score"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    await nominate(club, alice, YEAR, "Best Picture", 27);

    const awards = await awardsOf(club);
    expect(awards.body.awards[1].nominations).toEqual([]);
  });

  it("refuses a movie the member already nominated in that category", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27 },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await nominees(club)).toEqual({ 27: [alice.userId] });
  });

  it("refuses a nomination past the per-member limit", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 1);
    await nominate(club, alice, YEAR, "Best Picture", 2);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 3 },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(Object.keys(await nominees(club))).toEqual(["1", "2"]);
  });

  it("returns 400 before nominations open", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body: { awardTitle: "Best Picture", movieId: 27 },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await nominees(club)).toEqual({});
  });

  it("clears the category's ballots when a new nominee is added after voting", async () => {
    const { alice, bob, club } = await clubWithTwoMembers();
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 1);
    await nominate(club, alice, YEAR, "Best Picture", 2);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Ratings);
    await rankAward(club, alice, YEAR, "Best Picture", [2, 1]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    await nominate(club, bob, YEAR, "Best Picture", 3);

    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations.map((nomination) => nomination.ranking)).toEqual([
      {},
      {},
      {},
    ]);
  });

  it.each([
    ["no body", undefined],
    ["a movieId that is not a number", { awardTitle: "Best Picture", movieId: "27" }],
    ["a category that does not exist", { awardTitle: "Best Sound", movieId: 27 }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/nomination`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.awards[0].nominations).toEqual([]);
  });
});

describe("DELETE /api/club/:clubSlug/awards/:year/nomination/:movieId", () => {
  it("drops the signed-in member but keeps the nomination for the others", async () => {
    const { alice, bob, club } = await clubWithTwoMembers();
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);
    await nominate(club, bob, YEAR, "Best Picture", 27);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(await nominees(club)).toEqual({ 27: [bob.userId] });
  });

  it("removes the nomination entirely once its last nominator leaves", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);

    await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture" },
      as: alice,
    });

    expect(await nominees(club)).toEqual({});
  });

  it("cannot withdraw another member's nomination", async () => {
    const { alice, bob, club } = await clubWithTwoMembers();
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);

    await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture", userId: alice.userId },
      as: bob,
    });

    expect(await nominees(club)).toEqual({ 27: [alice.userId] });
  });

  it("returns 400 when the awardTitle query parameter is missing", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await nominees(club)).toEqual({ 27: [alice.userId] });
  });

  it("returns 400 once voting has started", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 27);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Ratings);

    const res = await api.delete(`/api/club/${club.slug}/awards/${YEAR}/nomination/27`, {
      query: { awardTitle: "Best Picture" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(await nominees(club)).toEqual({ 27: [alice.userId] });
  });
});

describe("POST /api/club/:clubSlug/awards/:year/ranking", () => {
  /** A year in voting with three nominees for Best Picture. */
  async function votingYear() {
    const { alice, bob, club } = await clubWithTwoMembers();
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 1);
    await nominate(club, alice, YEAR, "Best Picture", 2);
    await nominate(club, bob, YEAR, "Best Picture", 3);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Ratings);
    return { alice, bob, club };
  }

  it("records the signed-in member's ranking as the position of each movie", async () => {
    const { alice, club } = await votingYear();

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body: { awardTitle: "Best Picture", movies: [3, 1, 2] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations.map((nomination) => nomination.ranking)).toEqual([
      { [alice.userId]: 2 },
      { [alice.userId]: 3 },
      { [alice.userId]: 1 },
    ]);
  });

  it("keeps other voters' rankings", async () => {
    const { alice, bob, club } = await votingYear();
    await rankAward(club, bob, YEAR, "Best Picture", [1, 2, 3]);

    await rankAward(club, alice, YEAR, "Best Picture", [3, 2, 1]);

    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations[0].ranking).toEqual({
      [bob.userId]: 1,
      [alice.userId]: 3,
    });
  });

  it.each([
    ["no body", undefined],
    ["movies that are not numbers", { awardTitle: "Best Picture", movies: ["a"] }],
    ["a ballot missing a nominee", { awardTitle: "Best Picture", movies: [3, 1] }],
    ["a ballot naming a movie twice", { awardTitle: "Best Picture", movies: [1, 1, 2] }],
    ["a category that does not exist", { awardTitle: "Best Sound", movies: [1, 2, 3] }],
  ])("returns 400 with %s", async (_label, body) => {
    const { alice, club } = await votingYear();

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    const awards = await awardsOf(club);
    expect(awards.body.awards[0].nominations.map((nomination) => nomination.ranking)).toEqual([
      {},
      {},
      {},
    ]);
  });

  it("returns 400 outside of voting", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Nominations);
    await nominate(club, alice, YEAR, "Best Picture", 1);

    const res = await api.post(`/api/club/${club.slug}/awards/${YEAR}/ranking`, {
      body: { awardTitle: "Best Picture", movies: [1] },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/awards/:year/step", () => {
  it("advances the awards to the next step", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Nominations },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.Nominations);
  });

  it("reopens the previous step", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);
    await setAwardsStep(club, alice, YEAR, AwardsStep.Ratings);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Nominations },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.Nominations);
  });

  it("refuses to skip a step", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Presentation },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });

  it("refuses to open nominations with no categories", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Nominations },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });

  it.each([
    ["no body", undefined],
    ["a step that is not a number", { step: "Presentation" }],
    ["a step that does not exist", { step: 9 }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, { body, as: alice });

    expect(res.statusCode).toBe(400);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });
    await createAwardsYear(club, alice, YEAR, ["Best Picture"]);

    const res = await api.put(`/api/club/${club.slug}/awards/${YEAR}/step`, {
      body: { step: AwardsStep.Nominations },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
    expect((await awardsOf(club)).body.step).toBe(AwardsStep.CategorySelect);
  });
});
