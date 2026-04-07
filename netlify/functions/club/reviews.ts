import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import WorkCommentRepository from "../repositories/WorkCommentRepository";
import SharedReviewService from "../services/SharedReviewService";
import { secured } from "../utils/auth";
import { badRequest, ok, unauthorized } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubSlug/reviews");

const addReviewSchema = z.object({
  score: z.number().min(0).max(10),
  workId: z.string(),
  // Optional: when reviewing a movie that's currently on a user list,
  // the frontend passes the source list ID so the backend can move the
  // item into the reviews list atomically (matching the prior
  // "review from watchlist" behavior, but generalized to any list).
  sourceListId: z.string().optional(),
});

const queueSchema = z.object({
  sourceListId: z.string().optional(),
});

// Add a work to the reviews list without creating a score yet. Used by the
// "add review" prompt to push a movie from any user list (or a search) into
// the reviews queue.
router.post(
  "/:workId/queue",
  secured,
  async ({ clubId, params, event }, res) => {
    if (!hasValue(params.workId)) return res(badRequest("No workId provided"));
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = queueSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const workId = params.workId;
    const reviewsListId = await ListRepository.getReviewsListId(clubId);
    const { sourceListId } = body.data;

    if (hasValue(sourceListId) && sourceListId !== reviewsListId) {
      await ListRepository.moveItem(sourceListId, reviewsListId, workId);
    } else {
      const exists = await ListRepository.isItemInList(reviewsListId, workId);
      if (!exists) {
        await ListRepository.insertItemInList(reviewsListId, workId);
      }
    }
    return res(ok());
  },
);

router.delete("/:workId", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) return res(badRequest("No workId provided"));
  const reviewsListId = await ListRepository.getReviewsListId(clubId);
  await ListRepository.deleteItemFromList(reviewsListId, params.workId);
  return res(ok());
});

router.post("/", secured, async ({ clubId, userId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = addReviewSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const { score, workId, sourceListId } = body.data;

  const reviewsListId = await ListRepository.getReviewsListId(clubId);

  if (hasValue(sourceListId) && sourceListId !== reviewsListId) {
    // Move from the source user list into the reviews system list.
    // moveItem handles "already on reviews" via ON CONFLICT DO NOTHING.
    await ListRepository.moveItem(sourceListId, reviewsListId, workId);
  } else {
    // No source list (e.g. user searched for a fresh movie). Add it
    // directly to the reviews list if not already there.
    const exists = await ListRepository.isItemInList(reviewsListId, workId);
    if (!exists) {
      await ListRepository.insertItemInList(reviewsListId, workId);
    }
  }

  await ReviewRepository.insertReview(clubId, workId, userId, score);
  return res(ok());
});

const updateReviewSchema = z.object({
  score: z.number().min(0).max(10),
});

router.put(
  `/:reviewId`,
  secured,
  async ({ clubId, userId, params, event }, res) => {
    if (!hasValue(params.reviewId)) {
      return res(badRequest("No reviewId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateReviewSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const { score } = body.data;
    const reviewId = params.reviewId;
    const review = await ReviewRepository.getById(reviewId, clubId);
    if (review.user_id !== userId) {
      return res(badRequest("You are not allowed to edit this review"));
    }
    await ReviewRepository.updateScore(reviewId, score);
    return res(ok());
  },
);

// Comment endpoints

const addCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  spoiler: z.boolean().optional().default(false),
});

router.get("/:workId/comments", secured, async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }
  const comments = await WorkCommentRepository.getByWorkAndClub(
    params.workId,
    clubId,
  );
  return res(ok(JSON.stringify(comments)));
});

router.post(
  "/:workId/comments",
  secured,
  async ({ clubId, userId, params, event }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = addCommentSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    await WorkCommentRepository.insert(
      params.workId,
      clubId,
      userId,
      body.data.content,
      body.data.spoiler,
    );
    return res(ok());
  },
);

const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  spoiler: z.boolean().optional(),
});

router.put(
  "/:workId/comments/:commentId",
  secured,
  async ({ userId, params, event }, res) => {
    if (!hasValue(params.workId) || !hasValue(params.commentId)) {
      return res(badRequest("Missing parameters"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateCommentSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body"));

    const comment = await WorkCommentRepository.getById(params.commentId);
    if (!comment) {
      return res(badRequest("Comment not found"));
    }
    if (comment.user_id !== userId) {
      return res(unauthorized("You can only edit your own comments"));
    }

    await WorkCommentRepository.updateContent(
      params.commentId,
      userId,
      body.data.content,
      body.data.spoiler,
    );
    return res(ok());
  },
);

router.delete(
  "/:workId/comments/:commentId",
  secured,
  async ({ userId, params }, res) => {
    if (!hasValue(params.workId) || !hasValue(params.commentId)) {
      return res(badRequest("Missing parameters"));
    }
    const comment = await WorkCommentRepository.getById(params.commentId);
    if (!comment) {
      return res(badRequest("Comment not found"));
    }
    if (comment.user_id !== userId) {
      return res(unauthorized("You can only delete your own comments"));
    }
    await WorkCommentRepository.deleteById(params.commentId);
    return res(ok());
  },
);

router.get("/:workId/shared", async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }

  const workId = params.workId;
  const sharedReviewData = await SharedReviewService.getSharedReviewData(
    clubId,
    workId,
  );

  if (!sharedReviewData) {
    return res(badRequest("Work not found"));
  }

  return res(ok(JSON.stringify(sharedReviewData)));
});

export default router;
