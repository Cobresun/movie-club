import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import {
  DetailedReviewListItem,
  DetailedWorkData,
  DetailedWorkListItem,
  Review,
} from "../../../lib/types/lists.js";
import { listInsertDtoSchema } from "../../../lib/types/lists.js";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";
import { secured } from "../utils/auth";
import { getExternalDataForWorks } from "../utils/providers";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { ClubRequest, ListRequest, validListId } from "../utils/validation";

import { BadRequest } from "@/common/errorCodes";

const router = new Router<ClubRequest>("/api/club/:clubSlug/list");

// ---------------------------------------------------------------------------
// System list: reviews
//
// Reviews are kept as a dedicated path because the response shape is richer
// (per-user scores, average) than a regular list and the frontend has a
// dedicated query for it. Internally it resolves the system list ID via
// system_type.
// ---------------------------------------------------------------------------

router.get("/reviews", async ({ clubId }, res) => {
  const workList = await getReviewList(clubId);
  return res(ok(JSON.stringify(workList)));
});

// ---------------------------------------------------------------------------
// User lists collection
// ---------------------------------------------------------------------------

router.get("/", async ({ clubId }, res) => {
  const lists = await ListRepository.getListsForClub(clubId);
  return res(
    ok(
      JSON.stringify(
        lists.map((row) => ({
          id: String(row.id),
          title: row.title,
          systemType: row.system_type,
          itemCount: Number(row.item_count),
        })),
      ),
    ),
  );
});

router.get("/reviews-id", secured, async ({ clubId }, res) => {
  const id = await ListRepository.getReviewsListId(clubId);
  return res(ok(JSON.stringify({ id })));
});

const createListSchema = z.object({
  title: z.string().min(1).max(100),
});

const reorderListsSchema = z.object({
  listIds: z.array(z.string()).min(1),
});

router.put("/reorder", secured, async ({ clubId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body);
  } catch {
    return res(badRequest("Invalid JSON"));
  }
  const body = reorderListsSchema.safeParse(parsed);
  if (!body.success) return res(badRequest("Invalid body provided"));

  await ListRepository.reorderLists(clubId, body.data.listIds);
  return res(ok());
});

router.post("/", secured, async ({ clubId, event }, res) => {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));
  const body = createListSchema.safeParse(JSON.parse(event.body));
  if (!body.success) return res(badRequest("Invalid body provided"));

  const created = await ListRepository.createList(clubId, body.data.title);
  return res(
    ok(
      JSON.stringify({
        id: String(created.id),
        title: created.title,
        systemType: created.system_type,
        itemCount: 0,
      }),
    ),
  );
});

// ---------------------------------------------------------------------------
// Single list (operations on :listId)
//
// Each route runs validListId to load the list and verify it belongs to the
// resolved club, then secured for write operations. Routes are declared on
// the main router (rather than a sub-router) so the chain inference can
// thread ListRequest through validListId -> secured -> handler.
// ---------------------------------------------------------------------------

router.get("/:listId", validListId, async ({ listId }, res) => {
  const items = await ListRepository.getListItems(listId);
  const externalData = await getExternalDataForWorks(
    items.map((item) => ({ externalId: item.external_id, type: item.type })),
  );

  const mapped: DetailedWorkListItem<DetailedWorkData>[] = items.map(
    (item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      createdDate: item.time_added.toISOString(),
      imageUrl: item.image_url ?? undefined,
      externalId: item.external_id ?? undefined,
      addedBy: item.added_by_user_id ?? undefined,
      externalData: hasValue(item.external_id)
        ? externalData.get(item.external_id)
        : undefined,
    }),
  );
  return res(ok(JSON.stringify(mapped)));
});

const renameSchema = z.object({
  title: z.string().min(1).max(100),
});

router.put(
  "/:listId",
  validListId,
  secured<ListRequest>,
  async ({ listId, listSystemType, event }, res) => {
    if (listSystemType !== null) {
      return res(badRequest("Cannot rename a system list"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = renameSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body provided"));

    await ListRepository.renameList(listId, body.data.title);
    return res(ok());
  },
);

router.delete(
  "/:listId",
  validListId,
  secured<ListRequest>,
  async ({ listId, listSystemType }, res) => {
    if (listSystemType !== null) {
      return res(badRequest("Cannot delete a system list"));
    }
    await ListRepository.deleteList(listId);
    return res(ok());
  },
);

// -- items on a single list --

router.post(
  "/:listId/items",
  validListId,
  secured<ListRequest>,
  async ({ listId, clubId, userId, event }, res) => {
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = listInsertDtoSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body provided"));

    const { type, externalId } = body.data;
    let workId: string | undefined;
    if (hasValue(externalId)) {
      const existingWork = await WorkRepository.findByType(
        clubId,
        type,
        externalId,
      );
      workId = existingWork?.id;
    }
    if (!hasValue(workId)) {
      const newWork = await WorkRepository.insert(clubId, body.data);
      workId = newWork.id;
    }

    const exists = await ListRepository.isItemInList(listId, workId);
    if (exists) {
      return res(badRequest(BadRequest.ItemInList));
    }
    await ListRepository.insertItemInList(listId, workId, userId);
    return res(ok());
  },
);

router.delete(
  "/:listId/items/:workId",
  validListId,
  secured<ListRequest>,
  async ({ listId, clubId, params }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }
    const workId = params.workId;
    const exists = await ListRepository.isItemInList(listId, workId);
    if (!exists) {
      return res(badRequest("This movie does not exist in the list"));
    }
    await ListRepository.deleteItemFromList(listId, workId);
    try {
      await WorkRepository.delete(clubId, workId);
    } catch (e) {
      const error = e as { constraint?: string };
      if (error?.constraint !== "fk_work_list_item_work_id") {
        return res(internalServerError("Failed to delete work"));
      }
    }
    return res(ok());
  },
);

const reorderSchema = z.object({
  workIds: z.array(z.string()).min(1),
});

router.put(
  "/:listId/reorder",
  validListId,
  secured<ListRequest>,
  async ({ listId, event }, res) => {
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return res(badRequest("Invalid JSON"));
    }
    const body = reorderSchema.safeParse(parsed);
    if (!body.success) return res(badRequest("Invalid body provided"));

    await ListRepository.reorderList(listId, body.data.workIds);
    return res(ok());
  },
);

const updateAddedDateSchema = z.object({
  addedDate: z.string().datetime({ offset: true }),
});

router.put(
  "/:listId/items/:workId/added-date",
  validListId,
  secured<ListRequest>,
  async ({ listId, params, event }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = updateAddedDateSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body provided"));

    const workId = params.workId;
    const exists = await ListRepository.isItemInList(listId, workId);
    if (!exists) {
      return res(badRequest("This work does not exist in the list"));
    }
    await ListRepository.updateAddedDate(
      listId,
      workId,
      new Date(body.data.addedDate),
    );
    return res(ok());
  },
);

const moveSchema = z.object({
  destinationListId: z.string(),
});

router.post(
  "/:listId/items/:workId/move",
  validListId,
  secured<ListRequest>,
  async ({ listId, clubId, params, event }, res) => {
    if (!hasValue(params.workId)) {
      return res(badRequest("No workId provided"));
    }
    if (!hasValue(event.body)) return res(badRequest("No body provided"));
    const body = moveSchema.safeParse(JSON.parse(event.body));
    if (!body.success) return res(badRequest("Invalid body provided"));

    const destination = await ListRepository.getListById(
      body.data.destinationListId,
      clubId,
    );
    if (!destination) {
      return res(badRequest("Destination list not found"));
    }

    await ListRepository.moveItem(
      listId,
      String(destination.id),
      params.workId,
    );
    return res(ok());
  },
);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getReviewList(
  clubId: string,
): Promise<DetailedReviewListItem<DetailedWorkData>[]> {
  const [reviews, members] = await Promise.all([
    ReviewRepository.getReviewList(clubId),
    UserRepository.getMembersByClubId(clubId),
  ]);
  const memberIds = new Set(members.map((m) => m.id));

  const externalData = await getExternalDataForWorks(
    reviews.map((review) => ({
      externalId: review.external_id,
      type: review.type,
    })),
  );

  const groupedReviews = reviews.reduce((acc, review) => {
    const key = review.id;
    let arr = acc.get(key);
    if (!arr) {
      arr = [];
      acc.set(key, arr);
    }
    arr.push(review);
    return acc;
  }, new Map<string, (typeof reviews)[0][]>());

  return Array.from(groupedReviews.entries())
    .map(([key, items]) => {
      const review = items[0];

      const userScores: Record<string, Review> = items.reduce((acc, review) => {
        if (
          hasValue(review.user_id) &&
          hasValue(review.score) &&
          memberIds.has(review.user_id)
        ) {
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
      }, {});

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

      return {
        id: key,
        title: review.title,
        createdDate: review.time_added.toISOString(),
        type: review.type,
        imageUrl: review.image_url ?? undefined,
        externalId: review.external_id ?? undefined,
        scores,
        externalData: hasValue(review.external_id)
          ? externalData.get(review.external_id)
          : undefined,
      };
    })
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
}

export default router;
