import { RequestHandler } from "itty-router";

import { hasValue } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { AuthRequest } from "../../utils/auth";
import { badRequest, notFound } from "../../utils/responses";
import { ClubRequest } from "../../utils/validation";

export type YearRequest = {
  year: number;
} & ClubRequest;

export type AwardRequest = YearRequest & AuthRequest;

export const validYear: RequestHandler<YearRequest> = async (req) => {
  if (!hasValue(req.params.year)) return notFound();

  const year = parseInt(req.params.year);
  if (isNaN(year)) return badRequest();

  const exists = await AwardsRepository.existsByYear(req.clubId, year);

  if (!exists) {
    return notFound("Awards year not found");
  }

  req.year = year;
};
