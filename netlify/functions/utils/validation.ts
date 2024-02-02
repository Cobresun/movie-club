import { internalServerError, notFound } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import ClubRepository from "../repositories/ClubRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface ClubRequest extends Request {
  clubId?: string;
}

export interface LegacyClubRequest extends Request {
  clubId?: number;
}

export const validClubId: MiddlewareCallback = async (
  req: ClubRequest,
  next
) => {
  if (!req.params.clubId) return notFound();
  const clubId = req.params.clubId;

  if (await ClubRepository.exists(clubId)) {
    req.clubId = clubId;
    return next();
  } else {
    return notFound("Club not found");
  }
};

export const mapIdToLegacyId: MiddlewareCallback = async (
  req: ClubRequest,
  next
) => {
  const legacyId = await ClubRepository.getLegacyIdForId(req.clubId!);
  if (!legacyId) {
    return internalServerError("Invalid legacy id");
  }
  (req as LegacyClubRequest).clubId = parseInt(legacyId);
  return next();
};
