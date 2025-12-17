import { HandlerResponse } from "@netlify/functions";
import { betterAuth } from "better-auth";

import { dialect } from "./database.js";
import { unauthorized } from "./responses";
import { isRouterResponse, Request, RouterResponse } from "./router";
import { ClubRequest, LegacyClubRequest } from "./validation";
import ClubRepository from "../repositories/ClubRepository";

export const auth = betterAuth({
  database: dialect,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    database: {
      // Mixed ID types: auto-increment for user, UUIDs for session/account/verification
      generateId: (options) => {
        // Let database auto-generate integer IDs for user table
        if (options.model === "user" || options.model === "users") {
          return false; // Database handles auto-increment
        }
        // Generate UUIDs for other tables (session, account, verification)
        return crypto.randomUUID();
      },
    },
  },
});

export type AuthRequest<T extends Request = Request> = T & {
  email: string;
};

export const loggedIn = async <T extends Request>(
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => {
  // Get session from Better Auth using request headers
  const session = await auth.api.getSession({
    headers: new Headers(req.event.headers as Record<string, string>),
  });

  const email = session?.user?.email;
  if (email === null || email === undefined) {
    return res(unauthorized());
  }

  return {
    ...req,
    email,
  };
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
