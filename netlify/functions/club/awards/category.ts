import { z } from "zod";

import { awardTitleSchema, isSameCategoryTitle } from "../../../../lib/awards";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { type AwardsData, AwardsStep } from "../../../../lib/types/awards";
import AwardsRepository, {
  type AwardsRejection,
  reject,
} from "../../repositories/AwardsRepository";
import { parseBody } from "../../utils/parseBody";
import { badRequest, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { secured } from "../../utils/session";
import { type ClubAwardRequest } from "./utils";

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

// The title is free text, so it travels in the query string: Netlify decodes
// the path before routing, and a space, "/" or "(" no longer matches a segment.
router.delete("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const awardTitle = event.queryStringParameters?.awardTitle;
  if (!hasValue(awardTitle)) return res(badRequest("Missing award title in query parameters"));

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
