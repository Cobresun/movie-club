import ListRepository, { isWorkListType } from "../repositories/ListRepository";
import WorkRepository, { isWorkType } from "../repositories/WorkRepository";
import { secured } from "../utils/auth";
import { badRequest, internalServerError, ok } from "../utils/responses";
import { Router } from "../utils/router";
import { getDetailedWorks } from "../utils/tmdb";
import { ClubRequest } from "../utils/validation";

const router = new Router("/api/club/:clubId<\\d+>/list");

router.get("/:type", async ({ clubId, params }: ClubRequest) => {
  if (!params.type) {
    return badRequest("No type provided");
  }
  const type = params.type;
  if (!isWorkListType(type)) {
    return badRequest("Invalid type provided");
  }
  const list = await ListRepository.getListByType(clubId, type);
  const detailedWorks = await getDetailedWorks(
    list.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      createdDate: item.created_date.toISOString(),
      imageUrl: item.image_url ?? undefined,
      externalId: item.external_id ?? undefined,
    }))
  );

  return ok(JSON.stringify(detailedWorks));
});

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
      return badRequest("This movie already exists in the list");
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

export default router;
