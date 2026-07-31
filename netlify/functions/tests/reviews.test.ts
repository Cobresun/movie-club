/**
 * Integration tests for `netlify/functions/club/reviews.ts`.
 *
 * Scores, comments, the per-work scores map and the shared-review payload all
 * go through the real repositories and CockroachDB. Gemini and TMDB are faked
 * at the network boundary, so the discussion-questions route still builds its
 * real prompt and parses a real Gemini response envelope.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { WorkType } from "../../../lib/types/generated/db";
import { ReviewScores, SharedReviewResponse, WorkCommentDto } from "../../../lib/types/lists";
import { MovieCastMember } from "../../../lib/types/movie";
import { handler } from "../club/index";
import { geminiJsonResponse } from "./fixtures/external";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import {
  addMember,
  cacheMovieDetails,
  createClub,
  createComment,
  createReview,
  createReviewedWork,
  createUser,
  createWork,
} from "./helpers/factories";
import { requester } from "./helpers/http";
import { server } from "./setup/externalApis";

const api = requester(handler);

describe("POST /api/club/:clubSlug/reviews", () => {
  it("records the member's score for a work on the reviews list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: work.id, score: 8.5 },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const scores = await api.get<ReviewScores>(`/api/club/${club.slug}/reviews/${work.id}/scores`, {
      as: alice,
    });
    expect(scores.body[alice.userId].score).toBe(8.5);
  });

  it("rejects a work that is not on the reviews list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });

    const res = await api.post<{ error: string }>(`/api/club/${club.slug}/reviews`, {
      body: { workId: work.id, score: 5 },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This movie does not exist in the list");
  });

  it.each([
    ["a score above 10", 11],
    ["a negative score", -1],
  ])("returns 400 for %s", async (_label, score) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: work.id, score },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/reviews`, { as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/reviews`, {
      body: { workId: work.id, score: 5 },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/club/:clubSlug/reviews/:reviewId", () => {
  it("updates the author's own score", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });
    const reviewId = await createReview(club.reviewsListId, work.id, alice.userId, 4);

    const res = await api.put(`/api/club/${club.slug}/reviews/${reviewId}`, {
      body: { score: 9 },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const row = await db
      .selectFrom("review")
      .select("score")
      .where("id", "=", reviewId)
      .executeTakeFirstOrThrow();
    expect(Number(row.score)).toBe(9);
  });

  it("refuses to update another member's score", async () => {
    const alice = await signIn("alice");
    const carol = await signIn("carol");
    const club = await createClub({
      members: [{ userId: alice.userId }, { userId: carol.userId }],
    });
    const work = await createReviewedWork(club, { externalId: null });
    const reviewId = await createReview(club.reviewsListId, work.id, carol.userId, 4);

    const res = await api.put<{ error: string }>(`/api/club/${club.slug}/reviews/${reviewId}`, {
      body: { score: 1 },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("You are not allowed to edit this review");
    const row = await db
      .selectFrom("review")
      .select("score")
      .where("id", "=", reviewId)
      .executeTakeFirstOrThrow();
    expect(Number(row.score)).toBe(4);
  });

  it("cannot reach a review belonging to another club", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const otherClub = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(otherClub, { externalId: null });
    const reviewId = await createReview(otherClub.reviewsListId, work.id, alice.userId, 4);

    const res = await api.put(`/api/club/${club.slug}/reviews/${reviewId}`, {
      body: { score: 1 },
      as: alice,
    });

    // getById scopes the lookup to the club and throws when it finds nothing,
    // which the router turns into a 500 rather than letting the edit through.
    expect(res.statusCode).toBe(500);
    const row = await db
      .selectFrom("review")
      .select("score")
      .where("id", "=", reviewId)
      .executeTakeFirstOrThrow();
    expect(Number(row.score)).toBe(4);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });
    const reviewId = await createReview(club.reviewsListId, work.id, alice.userId, 4);

    const res = await api.put(`/api/club/${club.slug}/reviews/${reviewId}`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/reviews/:workId/scores", () => {
  it("returns one entry per member plus the average", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const other = await createUser({ name: "Other" });
    await addMember(club.id, other.userId);
    const work = await createReviewedWork(club, { externalId: null });
    await createReview(club.reviewsListId, work.id, alice.userId, 7);
    await createReview(club.reviewsListId, work.id, other.userId, 5);

    const res = await api.get<ReviewScores>(`/api/club/${club.slug}/reviews/${work.id}/scores`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body[alice.userId].score).toBe(7);
    expect(res.body[other.userId].score).toBe(5);
    expect(res.body.average.score).toBe(6);
  });

  it("returns an empty map before anyone has scored", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.get<ReviewScores>(`/api/club/${club.slug}/reviews/${work.id}/scores`, {
      as: alice,
    });

    expect(res.body).toEqual({});
  });
});

describe("GET /api/club/:clubSlug/reviews/cast", () => {
  it("returns the cast of every reviewed work, keyed by external id", async () => {
    const club = await createClub();
    await cacheMovieDetails("77");
    await createReviewedWork(club, { externalId: "77" });

    const res = await api.get<Record<string, MovieCastMember[]>>(
      `/api/club/${club.slug}/reviews/cast`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body["77"]).toEqual([
      { name: "Lead 77", character: "Hero 77", profilePath: "/lead-77.jpg" },
      { name: "Support 77", character: "Sidekick 77", profilePath: null },
    ]);
  });

  it("returns an empty object for a club with no reviews", async () => {
    const club = await createClub();

    const res = await api.get(`/api/club/${club.slug}/reviews/cast`);

    expect(res.body).toEqual({});
  });
});

describe("comments on a reviewed work", () => {
  it("returns comments oldest first with their author's profile", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });
    await createComment({
      workId: work.id,
      clubId: club.id,
      userId: alice.userId,
      content: "First",
    });
    await createComment({
      workId: work.id,
      clubId: club.id,
      userId: alice.userId,
      content: "Second",
      spoiler: true,
    });

    const res = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.map((comment) => [comment.content, comment.spoiler])).toEqual([
      ["First", false],
      ["Second", true],
    ]);
    expect(res.body[0].userName).toBe("Alice");
  });

  it("adds a comment", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/reviews/${work.id}/comments`, {
      body: { content: "Loved the third act", spoiler: true },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const comments = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body[0]).toMatchObject({
      content: "Loved the third act",
      spoiler: true,
      userId: alice.userId,
    });
  });

  it("defaults spoiler to false", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    await api.post(`/api/club/${club.slug}/reviews/${work.id}/comments`, {
      body: { content: "No spoilers here" },
      as: alice,
    });

    const comments = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body[0].spoiler).toBe(false);
  });

  it.each([
    ["empty content", { content: "" }],
    ["content over 2000 characters", { content: "x".repeat(2001) }],
    ["no body", undefined],
  ])("returns 400 for %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/reviews/${work.id}/comments`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });

  it("lets the author edit their comment", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });
    const commentId = await createComment({
      workId: work.id,
      clubId: club.id,
      userId: alice.userId,
      content: "Typo",
    });

    const res = await api.put(`/api/club/${club.slug}/reviews/${work.id}/comments/${commentId}`, {
      body: { content: "Fixed", spoiler: true },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const comments = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body[0]).toMatchObject({ content: "Fixed", spoiler: true });
  });

  it("returns 401 when editing someone else's comment", async () => {
    const alice = await signIn("alice");
    const carol = await signIn("carol");
    const club = await createClub({
      members: [{ userId: alice.userId }, { userId: carol.userId }],
    });
    const work = await createReviewedWork(club, { externalId: null });
    const commentId = await createComment({
      workId: work.id,
      clubId: club.id,
      userId: carol.userId,
      content: "Carol's take",
    });

    const res = await api.put<{ error: string }>(
      `/api/club/${club.slug}/reviews/${work.id}/comments/${commentId}`,
      { body: { content: "Hijacked" }, as: alice },
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("You can only edit your own comments");
    const comments = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body[0].content).toBe("Carol's take");
  });

  it("returns 400 when editing a comment that does not exist", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.put(`/api/club/${club.slug}/reviews/${work.id}/comments/999999`, {
      body: { content: "Ghost" },
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });

  it("lets the author delete their comment", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });
    const commentId = await createComment({
      workId: work.id,
      clubId: club.id,
      userId: alice.userId,
      content: "Delete me",
    });

    const res = await api.delete(
      `/api/club/${club.slug}/reviews/${work.id}/comments/${commentId}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(200);
    const comments = await api.get<WorkCommentDto[]>(
      `/api/club/${club.slug}/reviews/${work.id}/comments`,
      { as: alice },
    );
    expect(comments.body).toEqual([]);
  });

  it("returns 401 when deleting someone else's comment", async () => {
    const alice = await signIn("alice");
    const carol = await signIn("carol");
    const club = await createClub({
      members: [{ userId: alice.userId }, { userId: carol.userId }],
    });
    const work = await createReviewedWork(club, { externalId: null });
    const commentId = await createComment({
      workId: work.id,
      clubId: club.id,
      userId: carol.userId,
      content: "Carol's take",
    });

    const res = await api.delete<{ error: string }>(
      `/api/club/${club.slug}/reviews/${work.id}/comments/${commentId}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("You can only delete your own comments");
  });

  it("returns 400 when deleting a comment that does not exist", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.delete(`/api/club/${club.slug}/reviews/${work.id}/comments/999999`, {
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member reading comments", async () => {
    const bob = await signIn("bob");
    const club = await createClub();
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.get(`/api/club/${club.slug}/reviews/${work.id}/comments`, { as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/club/:clubSlug/reviews/:workId/discussion-questions", () => {
  it("returns the questions Gemini generated for the work", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { discussionQuestions: true },
    });
    await cacheMovieDetails("120");
    const work = await createReviewedWork(club, {
      externalId: "120",
      title: "The Lord of the Rings",
    });

    let prompt = "";
    server.use(
      http.post("https://generativelanguage.googleapis.com/*", async ({ request }) => {
        prompt = await request.text();
        return HttpResponse.json(geminiJsonResponse({ questions: ["Why the eagles?"] }));
      }),
    );

    const res = await api.post<{ questions: string[] }>(
      `/api/club/${club.slug}/reviews/${work.id}/discussion-questions`,
      { as: alice },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.questions).toEqual(["Why the eagles?"]);
    // The prompt is built server-side from the stored work, including the
    // release year from the cached TMDB details — a client cannot poison it.
    expect(prompt).toContain("The Lord of the Rings (2001)");
  });

  it("returns 400 when the feature is off for the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/reviews/${work.id}/discussion-questions`,
      { as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Feature not enabled");
  });

  it("returns 400 for a work that is not in the club", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { discussionQuestions: true },
    });

    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/reviews/999999/discussion-questions`,
      { as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Work not found");
  });

  it("returns 500 when Gemini returns a payload the schema rejects", async () => {
    const alice = await signIn("alice");
    const club = await createClub({
      members: [{ userId: alice.userId }],
      features: { discussionQuestions: true },
    });
    const work = await createReviewedWork(club, { externalId: null });
    server.use(
      http.post("https://generativelanguage.googleapis.com/*", () =>
        HttpResponse.json(geminiJsonResponse({ questions: [42] })),
      ),
    );

    const res = await api.post(`/api/club/${club.slug}/reviews/${work.id}/discussion-questions`, {
      as: alice,
    });

    expect(res.statusCode).toBe(500);
  });
});

describe("GET /api/club/:clubSlug/reviews/:workId/shared", () => {
  it("returns the work, its scores, members and comments without a session", async () => {
    const club = await createClub({ name: "Shared Club" });
    const member = await createUser({ name: "Member" });
    await addMember(club.id, member.userId);
    await cacheMovieDetails("500");
    const work = await createReviewedWork(club, {
      externalId: "500",
      title: "Reservoir Dogs",
      imageUrl: "/dogs.jpg",
    });
    await createReview(club.reviewsListId, work.id, member.userId, 9);
    await createComment({
      workId: work.id,
      clubId: club.id,
      userId: member.userId,
      content: "A classic",
    });

    const res = await api.get<SharedReviewResponse>(
      `/api/club/${club.slug}/reviews/${work.id}/shared`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.clubName).toBe("Shared Club");
    expect(res.body.work).toMatchObject({
      id: work.id,
      title: "Reservoir Dogs",
      type: WorkType.movie,
      imageUrl: "/dogs.jpg",
      externalId: "500",
    });
    // The shared payload carries the full metadata, cast included.
    expect(res.body.work.externalData).toMatchObject({ kind: "movie" });
    expect(res.body.members.map((member) => member.name)).toEqual(["Member"]);
    expect(res.body.comments.map((comment) => comment.content)).toEqual(["A classic"]);
    expect(res.body.reviews.map((review) => Number(review.score))).toEqual([9]);
  });

  it("omits external metadata for a work with no external id", async () => {
    const club = await createClub();
    const work = await createReviewedWork(club, { externalId: null });

    const res = await api.get<SharedReviewResponse>(
      `/api/club/${club.slug}/reviews/${work.id}/shared`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.work.externalData).toBeUndefined();
    expect(res.body.work.externalId).toBeUndefined();
  });

  it("returns 400 for an unknown work", async () => {
    const club = await createClub();

    const res = await api.get<{ error: string }>(`/api/club/${club.slug}/reviews/999999/shared`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Work not found");
  });
});
