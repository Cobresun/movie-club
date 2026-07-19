import { z } from "zod";

import { mapDiaryRows, mapForWorkRows } from "./diaryMapping";
import { hasValue } from "../../../lib/checks/checks.js";
import { listInsertDtoSchema } from "../../../lib/types/lists";
import { LogWatchResponse } from "../../../lib/types/me";
import WatchRepository from "../repositories/WatchRepository";
import WorkRepository, { isWorkType } from "../repositories/WorkRepository";
import { AuthRequest } from "../utils/auth";
import { getExternalDataForWorks } from "../utils/providers";
import { badRequest, notFound, ok } from "../utils/responses";
import { Router } from "../utils/router";

const router = new Router<AuthRequest>("/api/me/watches");

const logWatchSchema = z.object({
  work: listInsertDtoSchema,
  score: z.number().min(0).max(10).nullable().optional(),
  watchedDate: z.string().date().optional(),
  rewatch: z.boolean().optional().default(false),
  text: z.string().max(4000).optional(),
});

const editWatchSchema = z.object({
  score: z.number().min(0).max(10).nullable().optional(),
  watchedDate: z.string().date().nullable().optional(),
  rewatch: z.boolean().optional(),
  text: z.string().max(4000).nullable().optional(),
});

router.get("/", async ({ userId }, res) => {
  const watches = await WatchRepository.getMyWatches(userId);
  const clubReviews = await WatchRepository.getClubReviewsForWatchIds(
    watches.map((watch) => watch.watch_id),
  );
  return res(ok(JSON.stringify(mapDiaryRows(watches, clubReviews))));
});

router.post("/", async ({ userId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = logWatchSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  const { work, score, watchedDate, rewatch, text } = body.data;

  const insertedWork = await WorkRepository.insertForUser(userId, work);
  const watch = await WatchRepository.insertWatch({
    userId,
    workId: insertedWork.id,
    score: score ?? null,
    watchedDate: watchedDate ?? null,
    rewatch,
    text: text ?? null,
  });

  const response: LogWatchResponse = { watchId: watch.id };
  return res(ok(JSON.stringify(response)));
});

router.put("/:watchId", async ({ userId, params, event }, res) => {
  if (!hasValue(params.watchId)) {
    return res(badRequest("No watchId provided"));
  }
  const watchId = params.watchId;

  const existing = await WatchRepository.getByIdForUser(watchId, userId);
  if (!hasValue(existing?.id)) return res(notFound("Watch not found"));

  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = editWatchSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body"));

  // Score edits here propagate everywhere by construction: the watch row is
  // the single score every attached club review reads through.
  await WatchRepository.updateWatch(watchId, body.data);
  return res(ok());
});

router.delete("/:watchId", async ({ userId, params }, res) => {
  if (!hasValue(params.watchId)) {
    return res(badRequest("No watchId provided"));
  }
  const watchId = params.watchId;

  const existing = await WatchRepository.getByIdForUser(watchId, userId);
  if (!hasValue(existing?.id)) return res(notFound("Watch not found"));

  // The FK is RESTRICT — deleting a watch with club reviews attached would
  // orphan club history. Surface a real message instead of a constraint error.
  const clubReviewCount = await WatchRepository.clubReviewCount(watchId);
  if (clubReviewCount > 0) {
    return res(
      badRequest("This watch has club reviews attached and can't be deleted"),
    );
  }

  await WatchRepository.deleteWatch(watchId);
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

  const watches = await WatchRepository.getWatchesForWork(
    userId,
    type,
    externalId,
  );
  const clubReviews = await WatchRepository.getClubReviewsForWatchIds(
    watches.map((watch) => watch.watch_id),
  );
  return res(ok(JSON.stringify(mapForWorkRows(watches, clubReviews))));
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
