import { unauthorized } from "./responses";
import { MiddlewareCallback, Request } from "./router";
import { ClubRequest, LegacyClubRequest } from "./validation";
import ClubRepository from "../repositories/ClubRepository";

export interface AuthRequest extends Request {
  email: string;
}

export const loggedIn: MiddlewareCallback = (req, next) => {
  if (!req.context.clientContext || !req.context.clientContext.user)
    return Promise.resolve(unauthorized());

  req.email = req.context.clientContext.user.email;
  return next();
};

export const securedLegacy: MiddlewareCallback<
  LegacyClubRequest & AuthRequest
> = (req: LegacyClubRequest & AuthRequest, next) => {
  return loggedIn(req, async () => {
    if (
      !(await ClubRepository.isUserInClub(
        req.clubId.toString(),
        req.email,
        true,
      ))
    ) {
      return unauthorized();
    } else {
      return next();
    }
  });
};

export const secured: MiddlewareCallback<ClubRequest & AuthRequest> = (
  req: ClubRequest & AuthRequest,
  next,
) => {
  return loggedIn(req, async () => {
    if (
      !(await ClubRepository.isUserInClub(req.clubId.toString(), req.email))
    ) {
      return unauthorized();
    } else {
      return next();
    }
  });
};
