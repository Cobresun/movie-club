import { ClubAwardRequest, updateClubAwardYear } from "./utils";
import { secured } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router("/api/club/:clubId<\\d+>/awards/:year<\\d+>/step");
router.put("/", secured, async ({ event, clubId, year }: ClubAwardRequest) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.step) return badRequest("Missing step in body");

  const step = parseInt(body.step);
  const { faunaClient } = getFaunaClient();

  await faunaClient.query(updateClubAwardYear(clubId!, year!, { step }));

  return ok();
});

export default router;
