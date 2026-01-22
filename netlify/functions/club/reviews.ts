import { Router } from "itty-router";
import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import { WorkListType } from "../../../lib/types/generated/db";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import { secured } from "../utils/auth";
import { badRequest, ok } from "../utils/responses";
import { ClubRequest } from "../utils/validation";
import { overviewToExternalData } from "../utils/workDetailsMapper";

const router = Router<ClubRequest>({ base: "/api/club/:clubId/reviews" });

const addReviewSchema = z.object({
  score: z.number().min(0).max(10),
  workId: z.string(),
});

router.post("/", secured, async (req) => {
  const { clubId, email } = req;
  const jsonBody: unknown = await req.json();
  const body = addReviewSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const { score, workId } = body.data;

  const isItemInList = await ListRepository.isItemInList(
    clubId,
    WorkListType.reviews,
    workId,
  );
  if (!isItemInList) {
    return badRequest("This movie does not exist in the list");
  }
  const user = await UserRepository.getByEmail(email);
  await ReviewRepository.insertReview(clubId, workId, user.id, score);
  return ok();
});

const updateReviewSchema = z.object({
  score: z.number().min(0).max(10),
});

router.put("/:reviewId", secured, async (req) => {
  const { clubId, email, params } = req;
  const { reviewId } = params;

  if (!hasValue(reviewId)) {
    return badRequest("No reviewId provided");
  }

  const jsonBody: unknown = await req.json();
  const body = updateReviewSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const { score } = body.data;
  const user = await UserRepository.getByEmail(email);
  const review = await ReviewRepository.getById(reviewId, clubId);
  if (review.user_id !== user.id) {
    return badRequest("You are not allowed to edit this review");
  }
  await ReviewRepository.updateScore(reviewId, score);
  return ok();
});

router.get("/:workId/shared", async ({ clubId, params }) => {
  if (!hasValue(params.workId)) {
    return badRequest("No workId provided");
  }

  const workId = params.workId;
  const [reviews, members, workDetails] = await Promise.all([
    ReviewRepository.getReviewsByWorkId(clubId, workId),
    UserRepository.getMembersByClubId(clubId),
    ListRepository.getWorkDetails(workId),
  ]);

  if (!workDetails) {
    return badRequest("Work not found");
  }

  const work = {
    id: workDetails.id,
    title: workDetails.title,
    type: workDetails.type,
    imageUrl: workDetails.image_url ?? undefined,
    externalId: workDetails.external_id ?? undefined,
    externalData: overviewToExternalData(workDetails),
  };

  return ok(
    JSON.stringify({
      reviews,
      members,
      work,
    }),
  );
});

export default router;
