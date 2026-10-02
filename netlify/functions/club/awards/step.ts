import { z } from "zod";

import { stepChangeError } from "../../../../lib/awards";
import { AwardsStep } from "../../../../lib/types/awards";
import AwardsRepository, { reject } from "../../repositories/AwardsRepository";
import UserRepository from "../../repositories/UserRepository";
import { secured } from "../../utils/auth";
import { parseBody } from "../../utils/parseBody";
import { badRequest, ok } from "../../utils/responses";
import { isRouterResponse, Router } from "../../utils/router";
import { ClubAwardRequest } from "./utils";

const router = new Router<ClubAwardRequest>("/api/club/:clubSlug/awards/:year<\\d+>/step");

const updateStepSchema = z.object({
  step: z.nativeEnum(AwardsStep),
});

router.put("/", secured<ClubAwardRequest>, async ({ event, clubId, year }, res) => {
  const body = parseBody(event, updateStepSchema, res);
  if (isRouterResponse(body)) return body;

  const { step } = body;

  const members = await UserRepository.getMembersByClubId(clubId);
  const memberIds = members.map((member) => member.id);

  const rejection = await AwardsRepository.updateByYear(clubId, year, (currentData) => {
    const error = stepChangeError(currentData, step, memberIds);
    return error === undefined ? { ...currentData, step } : reject(error);
  });
  if (rejection) return res(badRequest(rejection.rejected));

  return res(ok());
});

export default router;
