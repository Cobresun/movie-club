import { notFound } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import { hasValue } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ClubRequest<T extends Request = Request> = T & {
  clubId: string;
  clubSlug: string;
};

/**
 * Middleware that accepts both numeric club IDs and slugs
 * If a numeric ID is provided, it redirects to the slug URL
 */
export const validClubIdOrSlug: MiddlewareCallback<
  Request,
  ClubRequest
> = async (req, res) => {
  const identifier = req.params.clubIdentifier;

  if (!hasValue(identifier)) {
    return res(notFound());
  }

  // Look up club by ID or slug
  const club = await ClubRepository.getByIdOrSlug(identifier);

  if (!club) {
    return res(notFound("Club not found"));
  }

  const clubId = String(club.id);
  const clubSlug = club.slug;

  // Otherwise, continue with the request
  return {
    ...req,
    clubId,
    clubSlug,
  };
};
