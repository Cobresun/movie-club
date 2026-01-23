import { hasValue } from "../../../../lib/checks/checks.js";
import AwardsRepository from "../../repositories/AwardsRepository";
import { badRequest, notFound } from "../../utils/web-responses";
import { MiddlewareCallback } from "../../utils/web-router";
import { WebClubRequest } from "../../utils/web-validation";

export interface WebClubAwardRequest extends WebClubRequest {
  year: number;
}

export const validYear: MiddlewareCallback<
  WebClubRequest,
  WebClubAwardRequest
> = async (req, res) => {
  if (!hasValue(req.params.year)) return res(notFound());
  const year = parseInt(req.params.year);
  if (isNaN(year)) return res(badRequest());

  const exists = await AwardsRepository.existsByYear(req.clubId, year);

  if (exists) {
    return {
      ...req,
      year,
    };
  } else {
    return res(notFound("Awards year not found"));
  }
};
