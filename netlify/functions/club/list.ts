import ListRepository, { isWorkListType } from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import WorkRepository, { isWorkType } from "../repositories/WorkRepository";
import { secured } from "../utils/auth";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedWorks } from "../utils/tmdb";
import { ClubRequest } from "../utils/validation";

import { BadRequest } from "@/common/errorCodes";
import { WorkListType } from "@/common/types/generated/db";
import { Review, ReviewListItem, WorkListItem } from "@/common/types/lists";

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
  return ok(JSON.stringify(workList));
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
    externalData: item.overview
      ? {
          adult: item.adult,
          backdrop_path: item.backdrop_path,
          budget: item.budget,
          homepage: item.homepage,
          imdb_id: item.imdb_id,
          original_language: item.original_language,
          original_title: item.original_title,
          overview: item.overview,
          popularity: item.popularity,
          poster_path: item.poster_path,
          release_date: item.release_date?.toISOString(),
          revenue: item.revenue,
          runtime: item.runtime,
          status: item.status,
          tagline: item.tagline,
          vote_average: item.tmdb_score,
          genres: item.genres?.filter(Boolean) ?? [],
          production_companies:
            item.production_companies?.filter(Boolean) ?? [],
          production_countries:
            item.production_countries?.filter(Boolean) ?? [],
        }
      : undefined,
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
    {},
  );

  return Object.keys(groupedReviews)
    .map((key) => {
      const review = groupedReviews[key][0];
      const userScores: Record<string, Review> = groupedReviews[key]?.reduce(
        (acc, review) => {
          if (review.user_id && review.score) {
            return {
              ...acc,
              [review.user_id]: {
                id: review.review_id,
                created_date: review.time_added.toISOString(),
                score: parseFloat(review.score),
              },
            };
          } else {
            return acc;
          }
        },
        {},
      );

      let scores: Record<string, Review>;
      if (Object.keys(userScores).length === 0) {
        scores = {};
      } else {
        scores = {
          ...userScores,
          average: {
            id: "average",
            created_date: new Date().toISOString(),
            score:
              Object.values(userScores).reduce(
                (acc, review) => acc + review.score,
                0,
              ) / Object.keys(userScores).length,
          },
        };
      }

      const externalData = review.overview
        ? {
            adult: review.adult,
            backdrop_path: review.backdrop_path,
            budget: review.budget,
            homepage: review.homepage,
            imdb_id: review.imdb_id,
            original_language: review.original_language,
            original_title: review.original_title,
            overview: review.overview,
            popularity: review.popularity,
            poster_path: review.poster_path,
            release_date: review.release_date?.toISOString(),
            revenue: review.revenue,
            runtime: review.runtime,
            status: review.status,
            tagline: review.tagline,
            vote_average: review.tmdb_score,
            genres: review.genres?.filter(Boolean) ?? [],
            production_companies:
              review.production_companies?.filter(Boolean) ?? [],
            production_countries:
              review.production_countries?.filter(Boolean) ?? [],
          }
        : undefined;

      return {
        id: key,
        title: review.title,
        createdDate: review.time_added.toISOString(),
        type: review.type,
        imageUrl: review.image_url ?? undefined,
        externalId: review.external_id ?? undefined,
        scores,
        externalData,
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
        body.externalId,
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
      workId,
    );
    if (isItemInList) {
      return badRequest(BadRequest.ItemInList);
    }
    await ListRepository.insertItemInList(clubId, type, workId);
    return ok();
  },
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
      workId,
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
  },
);

export default router;
