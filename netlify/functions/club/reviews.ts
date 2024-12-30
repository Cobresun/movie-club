import { WorkListType } from "../../../lib/types/generated/db";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import { AuthRequest, secured } from "../utils/auth";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router("/api/club/:clubId<\\d+>/reviews");

router.post(
  "/",
  secured,
  async ({ clubId, email, event }: ClubRequest & AuthRequest) => {
    if (!event.body) return badRequest("No body provided");
    const body = JSON.parse(event.body);
    if (!body.score) return badRequest("No score provided");
    if (!body.workId) return badRequest("No workId provided");

    const score = parseFloat(body.score);
    if (isNaN(score) || score < 0 || score > 10) {
      return badRequest("Invalid score provided");
    }
    const workId = body.workId;
    const isItemInList = await ListRepository.isItemInList(
      clubId,
      WorkListType.reviews,
      workId,
    );
    if (!isItemInList) {
      return badRequest("This movie does not exist in the list");
    }
    const user = await UserRepository.getByEmail(email);
    if (!user) {
      return internalServerError("Failed to find user");
    }
    await ReviewRepository.insertReview(clubId, workId, user.id, score);
    return ok();
  },
);

router.put(
  `/:reviewId`,
  secured,
  async ({ clubId, email, params, event }: ClubRequest & AuthRequest) => {
    if (!params.reviewId) {
      return badRequest("No reviewId provided");
    }
    if (!event.body) return badRequest("No body provided");
    const body = JSON.parse(event.body);
    if (!body.score) return badRequest("No score provided");
    const score = parseFloat(body.score);
    if (isNaN(score) || score < 0 || score > 10) {
      return badRequest("Invalid score provided");
    }
    const reviewId = params.reviewId;
    const user = await UserRepository.getByEmail(email);
    if (!user) {
      return internalServerError("Failed to find user");
    }
    const review = await ReviewRepository.getById(reviewId, clubId);
    if (!review) {
      return internalServerError("Failed to find review");
    }
    if (review.user_id !== user.id) {
      return badRequest("You are not allowed to edit this review");
    }
    await ReviewRepository.updateScore(reviewId, score);
    return ok();
  },
);

export default router;
