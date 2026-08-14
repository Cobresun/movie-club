import { z } from "zod";

import AwardsRepository from "../../repositories/AwardsRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/step");

const updateStepSchema = z.object({
  step: z.number(),
});

router.put("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const body = parseBody(event, updateStepSchema, res);
  if (isRouterResponse(body)) return body;

  const { step } = body;

  await AwardsRepository.updateByYear(clubId, year, (currentData) => ({
    ...currentData,
    step,
  }));

  return res(ok());
});

export default router;
