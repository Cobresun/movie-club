import { z } from "zod";

import { hasValue, isDefined } from "../../../lib/checks/checks.js";
import { WorkListType } from "../../../lib/types/generated/db";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import { secured } from "../utils/auth";
import { badRequest, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest } from "../utils/validation";

const router = new Router<ClubRequest>("/api/club/:clubId<\\d+>/reviews");

const addReviewSchema = z.object({
  score: z.number().min(0).max(10),
  workId: z.string(),
});

router.post("/", secured, async ({ clubId, email, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = addReviewSchema.safeParse(JSON.parse(event.body));
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
  secured,
  async ({ clubId, email, params, event }, res) => {
    if (!hasValue(params.reviewId)) {
      return res(badRequest("No reviewId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateReviewSchema.safeParse(JSON.parse(event.body));
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
    externalData: hasValue(workDetails.overview)
      ? {
          adult: workDetails.adult,
          backdrop_path: workDetails.backdrop_path,
          budget: workDetails.budget,
          homepage: workDetails.homepage,
          imdb_id: workDetails.imdb_id,
          original_language: workDetails.original_language,
          original_title: workDetails.original_title,
          overview: workDetails.overview,
          popularity: workDetails.popularity,
          poster_path: workDetails.poster_path,
          release_date: workDetails.release_date?.toISOString(),
          revenue: workDetails.revenue,
          runtime: workDetails.runtime,
          status: workDetails.status,
          tagline: workDetails.tagline,
          vote_average: isDefined(workDetails.tmdb_score)
            ? parseFloat(workDetails.tmdb_score)
            : undefined,
          genres: workDetails.genres?.filter(Boolean) ?? [],
          production_companies:
            workDetails.production_companies?.filter(Boolean) ?? [],
          production_countries:
            workDetails.production_countries?.filter(Boolean) ?? [],
        }
      : undefined,
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
