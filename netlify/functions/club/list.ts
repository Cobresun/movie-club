import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import {
  DetailedReviewListItem,
  DetailedWorkListItem,
  WorkDataSummary,
} from "../../../lib/types/lists.js";
import { listInsertDtoSchema } from "../../../lib/types/lists.js";
import ListRepository from "../repositories/ListRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import UserRepository from "../repositories/UserRepository";
import WorkRepository from "../repositories/WorkRepository";
import { secured } from "../utils/auth";
import { getExternalSummariesForWorks } from "../utils/providers";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { buildReviewScores } from "../utils/reviewScores";
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

// All items across the club's user lists in one request, tagged with their
// source list. Replaces the frontend's one-request-per-list fan-out (each of
// which paid its own function invocation + middleware queries).
router.get("/all-items", async ({ clubId }, res) => {
  const items = await ListRepository.getAllUserListItems(clubId);
  const externalData = await getExternalSummariesForWorks(
    items.map((item) => ({ externalId: item.external_id, type: item.type })),
  );

  const mapped = items.map((item) => ({
    ...toDetailedListItem(item, externalData),
    sourceListId: String(item.list_id),
    sourceListTitle: item.list_title,
  }));
  return res(ok(JSON.stringify(mapped)));
});

router.get("/:listId", validListId, async ({ listId }, res) => {
  const items = await ListRepository.getListItems(listId);
  const externalData = await getExternalSummariesForWorks(
    items.map((item) => ({ externalId: item.external_id, type: item.type })),
  );

  const mapped = items.map((item) => toDetailedListItem(item, externalData));
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

    // insert() upserts on (club_id, type, external_id) and always returns the
    // id, so no lookup-then-insert dance is needed. Its metadata fetch is a
    // no-op when details are already cached.
    const work = await WorkRepository.insert(clubId, body.data);

    // Single INSERT ... SELECT computes the position and detects "already in
    // list" via the (list_id, work_id) unique constraint in one round trip.
    const inserted = await ListRepository.insertItemInList(
      listId,
      work.id,
      userId,
    );
    if (!inserted) {
      return res(badRequest(BadRequest.ItemInList));
    }
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

    // Destination ownership is validated inside the move transaction (the
    // destination row is fetched there anyway), saving a separate round trip.
    const moved = await ListRepository.moveItem(
      listId,
      body.data.destinationListId,
      params.workId,
      clubId,
    );
    if (!moved) {
      return res(badRequest("Destination list not found"));
    }
    return res(ok());
  },
);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a joined work + list-item row to the API list-item shape, attaching
 * its external metadata summary. */
function toDetailedListItem(
  item: {
    id: string;
    title: string;
    type: DetailedWorkListItem["type"];
    time_added: Date;
    image_url: string | null;
    external_id: string | null;
    added_by_user_id: string | null;
  },
  externalData: Map<string, WorkDataSummary>,
): DetailedWorkListItem {
  return {
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
  };
}

async function getReviewList(
  clubId: string,
): Promise<DetailedReviewListItem[]> {
  const [reviews, members] = await Promise.all([
    ReviewRepository.getReviewList(clubId),
    UserRepository.getMembersByClubId(clubId),
  ]);
  const memberIds = new Set(members.map((m) => m.id));

  const externalData = await getExternalSummariesForWorks(
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

      const scores = buildReviewScores(items, memberIds);

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
