import { z } from "zod";

import { WebClubAwardRequest } from "./utils";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { webSecured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";

const router = new WebRouter<WebClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/category",
);

const addCategorySchema = z.object({
  title: z.string(),
});

router.post(
  "/",
  webSecured<WebClubAwardRequest>,
  async ({ request, clubId, year }, res) => {
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("Missing body"));
    const body = addCategorySchema.safeParse(JSON.parse(text));
    if (!body.success) return res(badRequest("Invalid body"));
    const { title } = body.data;

    await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
      ...currentData,
      awards: [...currentData.awards, { title, nominations: [] }],
    }));

    return res(ok());
  },
);

const updateCategorySchema = z.object({
  categories: z.array(z.string()),
});

router.put(
  "/",
  webSecured<WebClubAwardRequest>,
  async ({ request, clubId, year }, res) => {
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("Missing body"));
    const body = updateCategorySchema.safeParse(JSON.parse(text));
    if (!body.success) return res(badRequest("Invalid body"));

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

    return res(ok());
  },
);

router.delete(
  "/:awardTitle",
  webSecured<WebClubAwardRequest>,
  async ({ params, clubId, year }, res) => {
    const awardTitle = params.awardTitle;

    if (!hasValue(awardTitle)) return res(badRequest("Missing award title"));

    await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
      ...currentData,
      awards: currentData.awards.filter((award) => award.title !== awardTitle),
    }));

    return res(ok());
  },
);

export default router;
