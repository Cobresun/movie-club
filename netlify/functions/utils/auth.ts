import { HandlerResponse } from "@netlify/functions";

import { unauthorized } from "./responses";
import {
  isRouterResponse,
  MiddlewareCallback,
  Request,
  RouterResponse,
} from "./router";
import { ClubRequest, LegacyClubRequest } from "./validation";
import { isString } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export type AuthRequest<T extends Request = Request> = T & {
  email: string;
};

type UserContext = {
  email: string;
};

function isUserContext(context: unknown): context is UserContext {
  return (
    typeof context === "object" &&
    context !== null &&
    "email" in context &&
    isString(context.email)
  );
}

export const loggedIn = <T extends Request>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => {
  const user = req.context.clientContext?.user as unknown;
  if (!isUserContext(user)) {
    return Promise.resolve(res(unauthorized()));
  }

  return Promise.resolve({
    ...req,
    email: user.email,
  });
};

export const securedLegacy: MiddlewareCallback<
  LegacyClubRequest,
  LegacyClubRequest & AuthRequest
> = async (req, res) => {
  const loggedInResult = await loggedIn<LegacyClubRequest>(req, res);
  if (isRouterResponse(loggedInResult)) {
    return loggedInResult;
  }
  if (
    !(await ClubRepository.isUserInClub(
      req.clubId.toString(),
      loggedInResult.email,
      true,
    ))
  ) {
    return res(unauthorized());
  }

  return loggedInResult;
};

export const secured: MiddlewareCallback<
  ClubRequest,
  ClubRequest & AuthRequest
> = async (req, res) => {
  const loggedInResult = await loggedIn<ClubRequest>(req, res);
  if (isRouterResponse(loggedInResult)) {
    return loggedInResult;
  }

  if (!(await ClubRepository.isUserInClub(req.clubId, loggedInResult.email))) {
    return res(unauthorized());
  }

  return loggedInResult;
};
