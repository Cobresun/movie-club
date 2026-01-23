import { notFound } from "./web-responses";
import { MiddlewareCallback, WebRequest } from "./web-router";
import { hasValue } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export type WebClubRequest<T extends WebRequest = WebRequest> = T & {
  clubId: string;
};

export const validClubId: MiddlewareCallback<
  WebRequest,
  WebClubRequest
> = async (req, res) => {
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
