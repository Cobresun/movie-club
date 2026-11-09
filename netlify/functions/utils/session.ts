import { type HandlerEvent, type HandlerResponse } from "@netlify/functions";
import { betterAuth } from "better-auth";

import {
  filterUndefinedProperties,
  hasElements,
  hasValue,
  isDefined,
} from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";
import UserRepository from "../repositories/UserRepository";
import { sharedAuthOptions } from "./authOptions";
import { unauthorized } from "./responses";
import { isRouterResponse, type Request, type RouterResponse } from "./router";
import { type ClubRequest } from "./validation";

/**
 * Reads sessions for every function other than `/api/auth/*`. It leaves out
 * sign-up, password hashing, email and OAuth, which only `auth.ts` serves, so
 * those dependencies are not loaded by functions that only check a session.
 */
const sessionReader = betterAuth(sharedAuthOptions);

/** The signed-in user's id, or undefined for a request without a session. */
export const sessionUserId = async (event: HandlerEvent): Promise<string | undefined> => {
  // `disableRefresh` leaves renewing the session to the client's own
  // get-session call: a renewal here would push the database expiry out but
  // drop the Set-Cookie that goes with it, after which get-session sees nothing
  // left to renew and the browser's cookie lapses a month after sign-in.
  const session = await sessionReader.api.getSession({
    headers: new Headers(filterUndefinedProperties(event.headers)),
    query: { disableRefresh: true },
  });
  const userId = session?.user?.id;
  return hasValue(userId) ? userId : undefined;
};

export const loggedIn = async <T extends Request>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => {
  const userId = await sessionUserId(req.event);
  if (!isDefined(userId)) {
    return res(unauthorized());
  }

  return {
    ...req,
    userId,
  };
};

/**
 * Site-wide admin gate, used by the `/api/admin` endpoints.
 *
 * The schema has no notion of a site administrator: `club_member.role` is a
 * free-form per-club string that no server-side check has ever read. So access
 * is an email allowlist in `ADMIN_USER_EMAILS` (comma-separated), managed from
 * the Netlify console rather than the database.
 *
 * Fails closed — an unset or empty allowlist authorizes nobody, so a misconfigured
 * deploy hides the dashboard instead of exposing it to every logged-in user.
 */
export const siteAdmin = async <T extends Request>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => {
  const loggedInResult = await loggedIn<T>(req, res);
  if (isRouterResponse(loggedInResult)) {
    return loggedInResult;
  }

  const allowlist = (process.env.ADMIN_USER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(hasValue);

  if (!hasElements(allowlist)) {
    console.warn("ADMIN_USER_EMAILS is not set — denying admin request");
    return res(unauthorized());
  }

  const user = await UserRepository.getUserById(loggedInResult.userId);
  if (!allowlist.includes(user.email.trim().toLowerCase())) {
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

  if (!(await ClubRepository.isUserInClub(req.clubId, loggedInResult.userId))) {
    return res(unauthorized());
  }

  return loggedInResult;
};
