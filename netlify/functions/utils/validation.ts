import { getFaunaClient } from "./fauna";
import { badRequest, notFound } from "./responses";
import { MiddlewareCallback, Request } from "./router";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface ClubRequest extends Request {
  clubId?: number;
}

export const validClubId: MiddlewareCallback = async (
  req: ClubRequest,
  next
) => {
  if (!req.params.clubId) return notFound();
  const clubId = parseInt(req.params.clubId);
  if (isNaN(clubId)) return badRequest();

  const { faunaClient, q } = getFaunaClient();
  const clubExists = await faunaClient.query(
    q.Exists(q.Match(q.Index("club_by_clubId"), clubId))
  );

  if (clubExists) {
    req.clubId = clubId;
    return next();
  } else {
    return notFound("Club not found");
  }
};
