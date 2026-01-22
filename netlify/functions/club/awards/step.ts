import { Router } from "itty-router";
import { z } from "zod";

import { AwardRequest, YearRequest } from "./utils";
import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { badRequest, ok } from "../../utils/responses";

const router = Router<YearRequest>({
  base: "/api/club/:clubId/awards/:year/step",
});

const updateStepSchema = z.object({
  step: z.number(),
});

router.put("/", secured, async (req: AwardRequest) => {
  const { clubId, year } = req;

  const jsonBody: unknown = await req.json();
  const body = updateStepSchema.safeParse(jsonBody);
  if (!body.success) return badRequest("Invalid body");

  const { step } = body.data;

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    step,
  }));

  return ok();
});

export default router;
