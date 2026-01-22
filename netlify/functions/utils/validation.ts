import { IRequestStrict, RequestHandler } from "itty-router";

import { notFound } from "./responses";
import { hasValue } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ClubRequest = {
  clubId: string;
} & IRequestStrict;

export const validClubId: RequestHandler<ClubRequest> = async (request) => {
  const clubId = request.params?.clubId;

  if (!hasValue(clubId)) {
    return notFound();
  }

  if (!(await ClubRepository.exists(clubId))) {
    return notFound("Club not found");
  }

  request.clubId = clubId;
};
