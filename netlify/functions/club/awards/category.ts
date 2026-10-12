import { z } from "zod";

import { awardTitleSchema, isSameCategoryTitle } from "../../../../lib/awards";
import { isDefined } from "../../../../lib/checks/checks.js";
import { AwardsData, AwardsStep } from "../../../../lib/types/awards";
import AwardsRepository, { AwardsRejection, reject } from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { requireParam } from "../../utils/requireParam";
import { badRequest, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/category");

const categoriesLocked = (data: AwardsData): AwardsRejection | undefined =>
  data.step === AwardsStep.CategorySelect
    ? undefined
    : reject("Categories are locked once nominations open");

const addCategorySchema = z.object({
  title: awardTitleSchema,
});

router.post("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const body = parseBody(event, addCategorySchema, res);
  if (isRouterResponse(body)) return body;
  const { title } = body;

  const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) => {
    const locked = categoriesLocked(currentData);
    if (locked) return locked;
    if (currentData.awards.some((award) => isSameCategoryTitle(award.title, title))) {
      return reject(`"${title}" is already a category`);
    }
    return {
      ...currentData,
      awards: [...currentData.awards, { title, nominations: [] }],
    };
  });
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

const updateCategorySchema = z.object({
  categories: z.array(z.string()),
});

router.put("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const body = parseBody(event, updateCategorySchema, res);
  if (isRouterResponse(body)) return body;

  const { categories } = body;

  const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) => {
    const locked = categoriesLocked(currentData);
    if (locked) return locked;

    const updatedAwards = categories
      .map((category) => currentData.awards.find((award) => award.title === category))
      .filter(isDefined);

    if (
      categories.length !== currentData.awards.length ||
      new Set(updatedAwards).size !== currentData.awards.length
    ) {
      return reject("Send every category exactly once to reorder them");
    }

    return {
      ...currentData,
      awards: updatedAwards,
    };
  });
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

router.delete("/:awardTitle", secured<ClubAwardRequest>, async ({ params, clubId, year }, res) => {
  const awardTitle = requireParam(params, "awardTitle", res);
  if (isRouterResponse(awardTitle)) return awardTitle;

  const rejection = await AwardsRepository.updateByYear(
    clubId,
    year,
    (currentData) =>
      categoriesLocked(currentData) ?? {
        ...currentData,
        awards: currentData.awards.filter((award) => award.title !== awardTitle),
      },
  );
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

export default router;
