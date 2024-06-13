import ListRepository, { isWorkListType } from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository, { isWorkType } from "../repositories/WorkRepository";
import { AuthRequest, secured } from "../utils/auth";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedWorks } from "../utils/tmdb";
import { ClubRequest } from "../utils/validation";

import { BadRequest } from "@/common/errorCodes";
import { WorkListType } from "@/common/types/generated/db";
import { ReviewListItem, WorkListItem } from "@/common/types/lists";

const router = new Router("/api/club/:clubId<\\d+>/list");

router.get("/:type", async ({ clubId, params }: ClubRequest) => {
  if (!params.type) {
    return badRequest("No type provided");
  }
  const type = params.type;
  if (!isWorkListType(type)) {
    return badRequest("Invalid type provided");
  }

  let workList: WorkListItem[];
  switch (type) {
    case WorkListType.watchlist:
    case WorkListType.backlog:
      workList = await getWorkList(clubId, type);
      break;
    case WorkListType.reviews:
      workList = await getReviewList(clubId);
      break;
    default:
      return badRequest("Invalid type provided");
  }

  const detailedWorks = await getDetailedWorks(workList);

  return ok(JSON.stringify(detailedWorks));
});

async function getWorkList(clubId: string, type: WorkListType) {
  const list = await ListRepository.getListByType(clubId, type);
  return list.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    createdDate: item.time_added.toISOString(),
    imageUrl: item.image_url ?? undefined,
    externalId: item.external_id ?? undefined,
  }));
}

async function getReviewList(clubId: string): Promise<ReviewListItem[]> {
  const reviews = await ReviewRepository.getReviewList(clubId);
  const groupedReviews = reviews.reduce<Record<string, (typeof reviews)[0][]>>(
    (acc, review) => {
      const key = review.id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(review);
      return acc;
    },
    {}
  );

  return Object.keys(groupedReviews)
    .map((key) => {
      const userScores: Record<string, number> = groupedReviews[key]?.reduce(
        (acc, review) => {
          if (review.user_id && review.score) {
            return {
              ...acc,
              [review.user_id]: parseFloat(review.score),
            };
          } else {
            return acc;
          }
        },
        {}
      );
      let scores: Record<string, number>;
      if (Object.keys(userScores).length === 0) {
        scores = {};
      } else {
        scores = {
          ...userScores,
          average:
            Object.values(userScores).reduce((acc, score) => acc + score, 0) /
            Object.keys(userScores).length,
        };
      }
      return {
        id: key,
        title: groupedReviews[key][0].title,
        createdDate: groupedReviews[key][0].time_added.toISOString(),
        type: groupedReviews[key][0].type,
        imageUrl: groupedReviews[key][0].image_url ?? undefined,
        externalId: groupedReviews[key][0].external_id ?? undefined,
        scores,
      };
    })
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
}

router.post(
  "/:type",
  secured,
  async ({ clubId, params, event }: ClubRequest) => {
    if (!params.type) return badRequest("No type provided");
    if (!event.body) return badRequest("No body provided");
    const body = JSON.parse(event.body);
    if (!body.type || !body.title) return badRequest("Missing required fields");
    const type = params.type;
    if (!isWorkListType(type)) {
      return badRequest("Invalid list type provided");
    }

    if (!isWorkType(body.type)) return badRequest("Invalid work type provided");

    let workId: string | undefined;
    if (body.externalId) {
      const existingWork = await WorkRepository.findByType(
        clubId,
        body.type,
        body.externalId
      );
      workId = existingWork?.id;
    }

    if (!workId) {
      const newWork = await WorkRepository.insert(clubId, body);
      if (!newWork) return internalServerError("Failed to create work");
      workId = newWork.id;
    }
    const isItemInList = await ListRepository.isItemInList(
      clubId,
      type,
      workId
    );
    if (isItemInList) {
      return badRequest(BadRequest.ItemInList);
    }
    await ListRepository.insertItemInList(clubId, type, workId);
    return ok();
  }
);

router.delete(
  "/:type/:workId",
  secured,
  async ({ clubId, params }: ClubRequest) => {
    if (!params.type || !params.workId) {
      return badRequest("No type or workId provided");
    }
    const type = params.type;
    if (!isWorkListType(type)) {
      return badRequest("Invalid type provided");
    }
    const workId = params.workId;
    const isItemInList = await ListRepository.isItemInList(
      clubId,
      type,
      workId
    );
    if (!isItemInList) {
      return badRequest("This movie does not exist in the list");
    }
    await ListRepository.deleteItemFromList(clubId, type, workId);
    try {
      await WorkRepository.delete(clubId, workId);
    } catch (e) {
      const error = e as { constraint?: string };
      if (error?.constraint !== "fk_work_list_item_work_id") {
        return internalServerError("Failed to delete work");
      }
    }
    return ok();
  }
);

router.put(
  `/${WorkListType.reviews}/:workId`,
  secured,
  async ({ clubId, email, params, event }: ClubRequest & AuthRequest) => {
    if (!params.workId) return badRequest("No workId provided");
    if (!event.body) return badRequest("No body provided");
    const body = JSON.parse(event.body);
    if (!body.score) return badRequest("No score provided");
    const score = parseFloat(body.score);
    if (isNaN(score) || score < 0 || score > 10) {
      return badRequest("Invalid score provided");
    }
    const workId = params.workId;
    const isItemInList = await ListRepository.isItemInList(
      clubId,
      WorkListType.reviews,
      workId
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
  }
);

export default router;
