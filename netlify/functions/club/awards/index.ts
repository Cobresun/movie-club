import { Router } from "itty-router";

import categoryRouter from "./category";
import nominationRouter from "./nomination";
import rankingRouter from "./ranking";
import stepHandler from "./step";
import { validYear } from "./utils";
import { BaseAward, ClubAwards } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { notFound, ok } from "../../utils/responses";
import { getDetailedMovie } from "../../utils/tmdb";
import { ClubRequest, validClubId } from "../../utils/validation";

const router = Router<ClubRequest>({ base: "/api/club/:clubId/awards" });

router
  .all("/:year/category/*", validYear, categoryRouter.fetch)
  .all("/:year/step/*", validYear, stepHandler.fetch)
  .all("/:year/nomination/*", validYear, nominationRouter.fetch)
  .all("/:year/ranking/*", validYear, rankingRouter.fetch);

router.get("/:year", validYear, async ({ clubId, year }) => {
  const awardsData = await AwardsRepository.getByYear(clubId, year);
  if (!awardsData) {
    return notFound("Awards not found");
  }

  const retObj: ClubAwards = {
    year: year,
    step: awardsData.step,
    awards: await Promise.all(
      awardsData.awards.map(async (award: BaseAward) => ({
        ...award,
        nominations: await getDetailedMovie(award.nominations),
      })),
    ),
  };
  return ok(JSON.stringify(retObj));
});

router.get("/years", validClubId, async ({ clubId }) => {
  const years = await AwardsRepository.getYears(clubId);
  return ok(JSON.stringify(years));
});

export default router;
