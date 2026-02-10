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
 * Middleware that validates club slug and adds club data to request context
 */
export const validClubSlug: MiddlewareCallback<Request, ClubRequest> = async (
  req,
  res,
) => {
  const slug = req.params.clubSlug;

  if (!hasValue(slug)) {
    return res(notFound());
  }

  // Look up club by slug
  const club = await ClubRepository.getBySlug(slug);

  if (!club) {
    return res(notFound("Club not found"));
  }

  const clubId = String(club.id);
  const clubSlug = club.slug;

  return {
    ...req,
    clubId,
    clubSlug,
  };
};
