import { createAwardsYearSchema } from "../../../../lib/awards";
import { AwardsStep, BaseAward, ClubAwards } from "../../../../lib/types/awards";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { badRequest, notFound, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { getDetailedMovie } from "../../utils/tmdb";
import { ClubRequest } from "../../utils/validation";
import categoryRouter from "./category";
import nominationRouter from "./nomination";
import rankingRouter from "./ranking";
import stepHandler from "./step";
import { ClubAwardRequest, validYear } from "./utils";

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

router.delete(
  "/:year<\\d+>",
  validYear,
  secured<ClubAwardRequest>,
  async ({ clubId, year }, res) => {
    await AwardsRepository.deleteByYear(clubId, year);
    return res(ok());
  },
);

router.post("/", secured<ClubRequest>, async ({ event, clubId }, res) => {
  const body = parseBody(event, createAwardsYearSchema, res);
  if (isRouterResponse(body)) return body;
  const { year, categories } = body;

  const created = await AwardsRepository.create(clubId, year, {
    step: AwardsStep.CategorySelect,
    awards: categories.map((title) => ({ title, nominations: [] })),
  });
  if (!created) return res(badRequest(`This club already has ${year} awards`));

  return res(ok());
});

router.get("/years", async ({ clubId }, res) => {
  const years = await AwardsRepository.getYears(clubId);
  return res(ok(JSON.stringify(years)));
});

export default router;
