import categoryRouter from "./category";
import nominationRouter from "./nomination";
import rankingRouter from "./ranking";
import stepHandler from "./step";
import {
  getClubDocument,
  getClubProperty,
  getFaunaClient,
} from "../../utils/fauna";
import { notFound, ok } from "../../utils/responses";
import { Router } from "../../utils/router";
import { getDetailedMovie } from "../../utils/tmdb";

import { BaseClubAwards, ClubAwards } from "@/common/types/models";

const router = new Router("/api/club/:clubId<\\d+>/awards");
router.use("/:year<\\d+>/category", categoryRouter);
router.use("/:year<\\d+>/step", stepHandler);
router.use("/:year<\\d+>/nomination", nominationRouter);
router.use("/:year<\\d+>/ranking", rankingRouter);

router.get("/:year<\\d+>", async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const year = parseInt(params.year);
  const { faunaClient, q } = getFaunaClient();

  const clubAwards = await faunaClient.query<BaseClubAwards | null>(
    q.Select(
      0,
      q.Filter(
        q.Select(["data", "clubAwards"], getClubDocument(clubId)),
        q.Lambda("x", q.Equals(q.Select(["year"], q.Var("x")), year))
      ),
      null
    )
  );

  if (clubAwards) {
    const retObj: ClubAwards = {
      ...clubAwards,
      awards: await Promise.all(
        clubAwards.awards.map(async (award) => ({
          ...award,
          nominations: await getDetailedMovie(award.nominations),
        }))
      ),
    };
    return ok(JSON.stringify(retObj));
  } else {
    return notFound();
  }
});

router.get("/years", async (event, context, params) => {
  const clubId = parseInt(params.clubId);
  const { faunaClient, q } = getFaunaClient();

  const years = await faunaClient.query(
    q.Map(
      getClubProperty(clubId, "clubAwards"),
      q.Lambda("x", q.Select("year", q.Var("x")))
    )
  );

  return ok(JSON.stringify(years));
});

export default router;
