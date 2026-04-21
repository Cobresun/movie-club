import { AuthRequest, secured } from "./auth";
import { notFound } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import { hasValue } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";
import ListRepository from "../repositories/ListRepository";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export type ClubRequest<T extends Request = Request> = T & {
  clubId: string;
  clubSlug: string;
};

export type ListRequest<T extends ClubRequest = ClubRequest> = T & {
  listId: string;
  listSystemType: "reviews" | "award_nominations" | null;
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

/**
 * Middleware that resolves a `:listId` path param, asserts the list belongs
 * to the resolved club, and exposes the list's `system_type` so handlers can
 * gate operations on system lists (e.g. preventing rename/delete of `reviews`
 * or `award_nominations`). Without this guard, the new ID-keyed list routes
 * would be a horizontal-access vector since list IDs are just integers.
 */
export const validListId: MiddlewareCallback<ClubRequest, ListRequest> = async (
  req,
  res,
) => {
  const listId = req.params.listId;
  if (!hasValue(listId)) {
    return res(notFound("List not found"));
  }
  const list = await ListRepository.getListById(listId);
  if (!list || String(list.club_id) !== req.clubId) {
    return res(notFound("List not found"));
  }
  return {
    ...req,
    listId: String(list.id),
    listSystemType: list.system_type,
  };
};

/**
 * Non-generic alias of `secured` typed for ListRequest. The Router's chain
 * inference fails to instantiate `secured`'s `T extends ClubRequest` generic
 * to ListRequest when chained after validListId — it widens to ClubRequest
 * and the handler loses access to listId/listSystemType. This wrapper pins
 * T=ListRequest so the chain types resolve cleanly.
 */
export const securedList: MiddlewareCallback<
  ListRequest,
  AuthRequest<ListRequest>
> = (req, res) => secured(req, res);
