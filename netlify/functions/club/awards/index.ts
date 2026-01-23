import categoryRouter from "./category";
import nominationRouter from "./nomination";
import rankingRouter from "./ranking";
import stepHandler from "./step";
import { validYear } from "./utils";
import { BaseAward, ClubAwards } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { getDetailedMovie } from "../../utils/tmdb";
import { notFound, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";
import { WebClubRequest, validClubId } from "../../utils/web-validation";

const router = new WebRouter<WebClubRequest>("/api/club/:clubId<\\d+>/awards");
router.use("/:year<\\d+>/category", validYear, categoryRouter);
router.use("/:year<\\d+>/step", validYear, stepHandler);
router.use("/:year<\\d+>/nomination", validYear, nominationRouter);
router.use("/:year<\\d+>/ranking", validYear, rankingRouter);

router.get("/:year<\\d+>", validYear, async ({ clubId, year }, res) => {
  const awardsData = await AwardsRepository.getByYear(clubId, year);
  if (!awardsData) {
    return res(notFound("Awards not found"));
  }

  const retObj: ClubAwards = {
    year,
    step: awardsData.step,
    awards: await Promise.all(
      awardsData.awards.map(async (award: BaseAward) => ({
        ...award,
        nominations: await getDetailedMovie(award.nominations),
      })),
    ),
  };
  return res(ok(JSON.stringify(retObj)));
});

router.get("/years", validClubId, async ({ clubId }, res) => {
  const years = await AwardsRepository.getYears(clubId);
  return res(ok(JSON.stringify(years)));
});

export default router;
