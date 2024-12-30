import { HandlerResponse } from "@netlify/functions";

import { unauthorized } from "./responses";
import { isRouterResponse, Request, RouterResponse } from "./router";
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

export const securedLegacy = async <T extends LegacyClubRequest>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
): Promise<RouterResponse | T> => {
  const loggedInResult = await loggedIn<T>(req, res);
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

export const secured = async <T extends ClubRequest>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => {
  const loggedInResult = await loggedIn<T>(req, res);
  if (isRouterResponse(loggedInResult)) {
    return loggedInResult;
  }

  if (!(await ClubRepository.isUserInClub(req.clubId, loggedInResult.email))) {
    return res(unauthorized());
  }

  return loggedInResult;
};
