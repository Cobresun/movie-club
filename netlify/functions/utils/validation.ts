import { internalServerError, notFound } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import { hasValue } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ClubRequest<T extends Request = Request> = T & {
  clubId: string;
};

export type LegacyClubRequest<T extends Request = Request> = T & {
  clubId: number;
};

export const validClubId: MiddlewareCallback<Request, ClubRequest> = async (
  req,
  res,
) => {
  if (!hasValue(req.params.clubId)) return res(notFound());
  const clubId = req.params.clubId;

  if (await ClubRepository.exists(clubId)) {
    return {
      ...req,
      clubId,
    };
  } else {
    return res(notFound("Club not found"));
  }
};

export const mapIdToLegacyId: MiddlewareCallback<
  ClubRequest,
  LegacyClubRequest
> = async (req, res) => {
  const legacyId = await ClubRepository.getLegacyIdForId(req.clubId);
  if (legacyId === null) {
    return res(internalServerError("Invalid legacy id"));
  }

  return {
    ...req,
    clubId: parseInt(legacyId, 10),
  };
};
