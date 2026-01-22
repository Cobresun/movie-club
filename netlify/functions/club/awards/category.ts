import { Router } from "itty-router";
import { z } from "zod";

import { AwardRequest, YearRequest } from "./utils";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";

const router = Router<YearRequest>({
  base: "/api/club/:clubId/awards/:year/category",
});

const addCategorySchema = z.object({
  title: z.string(),
});

router.post("/", secured, async (req: AwardRequest) => {
  const { clubId, year } = req;

  const jsonBody: unknown = await req.json();
  const body = addCategorySchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");
  const { title } = body.data;

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    awards: [...currentData.awards, { title, nominations: [] }],
  }));

  return ok();
});

const updateCategorySchema = z.object({
  categories: z.array(z.string()),
});

router.put("/", secured, async (req: AwardRequest) => {
  const { clubId, year } = req;
  const jsonBody: unknown = await req.json();
  const body = updateCategorySchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const { categories } = body.data;

  await AwardsRepository.updateByYear(clubId, year, (currentData) => {
    // Reorder awards based on the categories order
    const updatedAwards = categories
      .map((category) =>
        currentData.awards.find((award) => award.title === category),
      )
      .filter(isDefined);

    if (updatedAwards.length !== categories.length) {
      throw new Error(
        "One or more of the category titles you provided does not exist",
      );
    }

    return {
      ...currentData,
      awards: updatedAwards,
    };
  });

  return ok();
});

router.delete("/:awardTitle", secured, async (req: AwardRequest) => {
  const { params, clubId, year } = req;
  const awardTitle = params.awardTitle;

  if (!hasValue(awardTitle)) return badRequest("Missing award title");

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    awards: currentData.awards.filter((award) => award.title !== awardTitle),
  }));

  return ok();
});

export default router;
