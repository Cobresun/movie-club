import { getClubProperty, getFaunaClient } from "../utils/fauna";
import { ok } from "../utils/responses";
import { Router } from "../utils/router";

const router = new Router("/api/club/:clubId<\\d+>/members");

router.get("/", async (event, context, params) => {
  const { faunaClient, q } = getFaunaClient();
  const clubId = parseInt(params.clubId);
  const members = await faunaClient.query(
    q.Map(
      getClubProperty(clubId, "members"),
      q.Lambda("memberRef", q.Select("data", q.Get(q.Var("memberRef"))))
    )
  );
  return ok(JSON.stringify(members));
});

export { router };
