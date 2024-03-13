import ListRepository from "../repositories/ListRepository";
import WorkRepository from "../repositories/WorkRepository";
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
  const list = await ListRepository.getListByType(clubId, type);
  const detailedMovies = await getDetailedWorks(
    list.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      createdDate: item.created_date.toISOString(),
      imageUrl: item.image_url ?? undefined,
      externalId: item.external_id ?? undefined,
    }))
  );

  return ok(JSON.stringify(detailedMovies));
});

router.post("/:type", async ({ clubId, params, event }: ClubRequest) => {
  if (!params.type) return badRequest("No type provided");
  if (!event.body) return badRequest("No body provided");
  const body = JSON.parse(event.body);
  if (!body.type || !body.title) return badRequest("Missing required fields");

  const type = params.type;

  let workId: string | undefined;
  if (body.externalId) {
    const existingWork = await WorkRepository.findByType(
      clubId,
      type,
      body.externalId
    );
    workId = existingWork?.id;
  }

  if (!workId) {
    const newWork = await WorkRepository.insert(clubId, body);
    if (!newWork) return internalServerError("Failed to create work");
    workId = newWork.id;
  }
  const isItemInList = await ListRepository.isItemInList(clubId, type, workId);
  if (isItemInList) {
    return badRequest("This movie already exists in the list");
  }
  await ListRepository.insertItemInList(clubId, type, workId);
  return ok();
});

export default router;
