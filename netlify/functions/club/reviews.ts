import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import { WorkListType } from "../../../lib/types/generated/db";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import { webSecured } from "../utils/auth";
import { badRequest, ok } from "../utils/web-responses";
import { WebRouter } from "../utils/web-router";
import { WebClubRequest } from "../utils/web-validation";
import { overviewToExternalData } from "../utils/workDetailsMapper";

const router = new WebRouter<WebClubRequest>("/api/club/:clubId<\\d+>/reviews");

const addReviewSchema = z.object({
  score: z.number().min(0).max(10),
  workId: z.string(),
});

router.post("/", webSecured, async ({ clubId, email, request }, res) => {
  const text = await request.text();
  if (!hasValue(text)) return res(badRequest("No body provided"));
  const body = addReviewSchema.safeParse(JSON.parse(text));
  if (!body.success) return res(badRequest("Invalid body"));

  const { score, workId } = body.data;

  const isItemInList = await ListRepository.isItemInList(
    clubId,
    WorkListType.reviews,
    workId,
  );
  if (!isItemInList) {
    return res(badRequest("This movie does not exist in the list"));
  }
  const user = await UserRepository.getByEmail(email);
  await ReviewRepository.insertReview(clubId, workId, user.id, score);
  return res(ok());
});

const updateReviewSchema = z.object({
  score: z.number().min(0).max(10),
});

router.put(
  `/:reviewId`,
  webSecured,
  async ({ clubId, email, params, request }, res) => {
    if (!hasValue(params.reviewId)) {
      return res(badRequest("No reviewId provided"));
    }
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("No body provided"));
    const body = updateReviewSchema.safeParse(JSON.parse(text));
    if (!body.success) return res(badRequest("Invalid body"));

    const { score } = body.data;
    const reviewId = params.reviewId;
    const user = await UserRepository.getByEmail(email);
    const review = await ReviewRepository.getById(reviewId, clubId);
    if (review.user_id !== user.id) {
      return res(badRequest("You are not allowed to edit this review"));
    }
    await ReviewRepository.updateScore(reviewId, score);
    return res(ok());
  },
);

router.get("/:workId/shared", async ({ clubId, params }, res) => {
  if (!hasValue(params.workId)) {
    return res(badRequest("No workId provided"));
  }

  const workId = params.workId;
  const [reviews, members, workDetails] = await Promise.all([
    ReviewRepository.getReviewsByWorkId(clubId, workId),
    UserRepository.getMembersByClubId(clubId),
    ListRepository.getWorkDetails(workId),
  ]);

  if (!workDetails) {
    return res(badRequest("Work not found"));
  }

  const work = {
    id: workDetails.id,
    title: workDetails.title,
    type: workDetails.type,
    imageUrl: workDetails.image_url ?? undefined,
    externalId: workDetails.external_id ?? undefined,
    externalData: overviewToExternalData(workDetails),
  };

  return res(
    ok(
      JSON.stringify({
        reviews,
        members,
        work,
      }),
    ),
  );
});

export default router;
