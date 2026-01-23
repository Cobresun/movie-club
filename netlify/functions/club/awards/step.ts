import { z } from "zod";

import { WebClubAwardRequest } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { webSecured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/web-responses";
import { WebRouter } from "../../utils/web-router";

const router = new WebRouter<WebClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/step",
);

const updateStepSchema = z.object({
  step: z.number(),
});

router.put(
  "/",
  webSecured<WebClubAwardRequest>,
  async ({ request, clubId, year }, res) => {
    const text = await request.text();
    if (!hasValue(text)) return res(badRequest("Missing body"));
    const body = updateStepSchema.safeParse(JSON.parse(text));
    if (!body.success) return res(badRequest("Invalid body"));

    const { step } = body.data;

    await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
      ...currentData,
      step,
    }));

    return res(ok());
  },
);

export default router;
