import categoryRouter from "./category.js";
import nominationRouter from "./nomination.js";
import rankingRouter from "./ranking.js";
import stepHandler from "./step.js";
import { validYear } from "./utils.js";
import { BaseAward, ClubAwards } from "../../../../lib/types/awards.js";
import AwardsRepository from "../../repositories/AwardsRepository.js";
import { notFound, ok } from "../../utils/responses.js";
import { Router } from "../../utils/router.js";
import { getDetailedMovie } from "../../utils/tmdb.js";
import { ClubRequest } from "../../utils/validation.js";

const router = new Router<ClubRequest>("/api/club/:clubSlug/awards");
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

router.get("/years", async ({ clubId }, res) => {
  const years = await AwardsRepository.getYears(clubId);
  return res(ok(JSON.stringify(years)));
});

export default router;
