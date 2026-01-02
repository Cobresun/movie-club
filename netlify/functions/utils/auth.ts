import { HandlerResponse } from "@netlify/functions";
import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";

import { dialect } from "./database.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";
import { unauthorized } from "./responses";
import { isRouterResponse, Request, RouterResponse } from "./router";
import { ClubRequest, LegacyClubRequest } from "./validation";
import { filterUndefinedProperties } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

export const auth = betterAuth({
  database: dialect,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url, user.name);
    },
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url, user.name);
    },
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
    headers: new Headers(filterUndefinedProperties(req.event.headers)),
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
