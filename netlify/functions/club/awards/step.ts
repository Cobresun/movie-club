import { z } from "zod";

import { ClubAwardRequest } from "./utils";
import { hasValue } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";
import { Router } from "../../utils/router";

const router = new Router<ClubAwardRequest>(
  "/api/club/:clubId<\\d+>/awards/:year<\\d+>/step",
);

const updateStepSchema = z.object({
  step: z.number(),
});

router.put(
  "/",
  secured<ClubAwardRequest>,
  async ({ event, clubId, year }, res) => {
    if (!hasValue(event.body)) return res(badRequest("Missing body"));
    const body = updateStepSchema.safeParse(JSON.parse(event.body));
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
