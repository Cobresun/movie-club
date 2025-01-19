import categoryRouter from "./category";
import nominationRouter from "./nomination";
import rankingRouter from "./ranking";
import stepHandler from "./step";
import { validYear } from "./utils";
import { ClubAwards } from "../../../../lib/types/awards";
import { getClubProperty, getFaunaClient } from "../../utils/fauna";
import { ok } from "../../utils/responses";
import { Router } from "../../utils/router";
import { getDetailedMovie } from "../../utils/tmdb";
import { LegacyClubRequest } from "../../utils/validation";

const router = new Router<LegacyClubRequest>("/api/club/:clubId<\\d+>/awards");
router.use("/:year<\\d+>/category", validYear, categoryRouter);
router.use("/:year<\\d+>/step", validYear, stepHandler);
router.use("/:year<\\d+>/nomination", validYear, nominationRouter);
router.use("/:year<\\d+>/ranking", validYear, rankingRouter);

router.get("/:year<\\d+>", validYear, async ({ clubAwards }, res) => {
  const retObj: ClubAwards = {
    ...clubAwards,
    awards: await Promise.all(
      clubAwards.awards.map(async (award) => ({
        ...award,
        nominations: await getDetailedMovie(award.nominations),
      })),
    ),
  };
  return res(ok(JSON.stringify(retObj)));
});

router.get("/years", async ({ clubId }, res) => {
  const { faunaClient, q } = getFaunaClient();

  const years = await faunaClient.query(
    q.Map(
      getClubProperty(clubId, "clubAwards"),
      q.Lambda("x", q.Select("year", q.Var("x"))),
    ),
  );

  return res(ok(JSON.stringify(years)));
});

export default router;
