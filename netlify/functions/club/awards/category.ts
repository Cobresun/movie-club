import { updateClubAwardYear } from "./utils";
import { secured } from "../../utils/auth";
import { getFaunaClient } from "../../utils/fauna";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/category"
);
router.post("/", secured, async (event, context, params) => {
  if (!event.body) return badRequest("Missing body");
  const body = JSON.parse(event.body);
  if (!body.title) return badRequest("Missing title in body");

  const clubId = parseInt(params.clubId);
  const year = parseInt(params.year);
  const { faunaClient, q } = getFaunaClient();

  await faunaClient.query(
    updateClubAwardYear(clubId, year, {
      awards: q.Append(
        [{ title: body.title, nominations: [] }],
        q.Select("awards", q.Var("awardYear"))
      ),
    })
  );

  return ok();
});

export default router;
