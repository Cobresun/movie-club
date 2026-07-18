import { z } from "zod";

import { mapDiaryRows, mapForWorkRows } from "./diaryMapping";
import { hasValue } from "../../../lib/checks/checks.js";
import { listInsertDtoSchema } from "../../../lib/types/lists";
import { LogWatchResponse } from "../../../lib/types/me";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import WorkRepository, { isWorkType } from "../repositories/WorkRepository";
import { AuthRequest } from "../utils/auth";
import { getExternalDataForWorks } from "../utils/providers";
import { badRequest, notFound, ok } from "../utils/responses";
import { Router } from "../utils/router";

const router = new Router<AuthRequest>("/api/me/reviews");

const logWatchSchema = z.object({
  work: listInsertDtoSchema,
  score: z.number().min(0).max(10).nullable().optional(),
  watchedDate: z.string().date().optional(),
  rewatch: z.boolean().optional().default(false),
  text: z.string().max(4000).optional(),
});

const editSoloReviewSchema = z.object({
  score: z.number().min(0).max(10).nullable().optional(),
  watchedDate: z.string().date().nullable().optional(),
  rewatch: z.boolean().optional(),
  text: z.string().max(4000).nullable().optional(),
});

router.get("/", async ({ userId }, res) => {
  const rows = await ReviewRepository.getMyReviewStream(userId);
  return res(ok(JSON.stringify(mapDiaryRows(rows))));
});

router.post("/", async ({ userId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = logWatchSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const { work, score, watchedDate, rewatch, text } = body.data;

  // Order matters: the composite FK fk_review_work_list_item_id requires the
  // work_list_item row to exist before the review, so provision list → work →
  // list item → review, in that sequence.
  const listId = await ListRepository.getOrCreateSoloReviewsListId(userId);
  const insertedWork = await WorkRepository.insertForUser(userId, work);
  const workId = insertedWork.id;

  const alreadyInList = await ListRepository.isItemInList(listId, workId);
  if (!alreadyInList) {
    await ListRepository.insertItemInList(listId, workId, userId);
  }

  const review = await ReviewRepository.insertSoloReview({
    listId,
    workId,
    userId,
    score: score ?? null,
    watchedDate: watchedDate ?? null,
    rewatch,
    text: text ?? null,
  });

  const response: LogWatchResponse = { reviewId: review.id };
  return res(ok(JSON.stringify(response)));
});

router.put("/:reviewId", async ({ userId, params, event }, res) => {
  if (!hasValue(params.reviewId)) {
    return res(badRequest("No reviewId provided"));
  }
  const reviewId = params.reviewId;

  // Gate on solo ownership. Absent covers both "not yours" and "club event"
  // (club rows join through work_list.club_id, not user_id).
  const existing = await ReviewRepository.getSoloById(reviewId, userId);
  if (!hasValue(existing?.id)) return res(notFound("Review not found"));

  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = editSoloReviewSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  await ReviewRepository.updateSoloEvent(reviewId, body.data);
  return res(ok());
});

router.delete("/:reviewId", async ({ userId, params }, res) => {
  if (!hasValue(params.reviewId)) {
    return res(badRequest("No reviewId provided"));
  }
  const reviewId = params.reviewId;

  const existing = await ReviewRepository.getSoloById(reviewId, userId);
  if (!hasValue(existing?.id)) return res(notFound("Review not found"));

  await ReviewRepository.deleteSoloReview(reviewId);
  return res(ok());
});

router.get("/for-work", async ({ userId, event }, res) => {
  const type = event.queryStringParameters?.type;
  const externalId = event.queryStringParameters?.externalId;

  if (!hasValue(type) || !isWorkType(type)) {
    return res(badRequest("Invalid or missing type"));
  }
  if (!hasValue(externalId)) {
    return res(badRequest("Missing externalId"));
  }

  const rows = await ReviewRepository.getEventsForWork(
    userId,
    type,
    externalId,
  );
  return res(ok(JSON.stringify(mapForWorkRows(rows))));
});

// Cached external metadata (TMDB / Google Books) for one work, used by the
// library timeline drawer to render the same rich sections as the club reviews
// drawer. This is public work metadata keyed by external id — no ownership gate
// beyond the loggedIn mount — so it mirrors what the club list endpoint already
// exposes. Returns `null` when the provider has nothing cached for the id.
router.get("/work-details", async ({ event }, res) => {
  const type = event.queryStringParameters?.type;
  const externalId = event.queryStringParameters?.externalId;

  if (!hasValue(type) || !isWorkType(type)) {
    return res(badRequest("Invalid or missing type"));
  }
  if (!hasValue(externalId)) {
    return res(badRequest("Missing externalId"));
  }

  const externalData = await getExternalDataForWorks([{ type, externalId }]);
  return res(ok(JSON.stringify(externalData.get(externalId) ?? null)));
});

export default router;
