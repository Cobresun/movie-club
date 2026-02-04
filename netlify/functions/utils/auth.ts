import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { z } from "zod";

import { dialect } from "./database.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";
import { unauthorized } from "./responses";
import { isRouterResponse, FnRequest, RouterResponse } from "./router";
import { ClubRequest } from "./validation";
import { ensure, isDefined } from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

const googleClientId = ensure(
  process.env.GOOGLE_CLIENT_ID,
  "GOOGLE_CLIENT_ID is not set",
);
const googleClientSecret = ensure(
  process.env.GOOGLE_CLIENT_SECRET,
  "GOOGLE_CLIENT_SECRET is not set",
);

const authConfigSchema = z.object({
  trustedOrigins: z.array(z.string()),
});

function getTrustedOrigins(): string[] {
  const configPath = path.resolve("./auth-config.json");

  try {
    if (existsSync(configPath)) {
      const fileContents = readFileSync(configPath, "utf-8");
      const parsed = authConfigSchema.parse(JSON.parse(fileContents));
      return parsed.trustedOrigins;
    }
  } catch {
    // Silent fallback to env vars for local development
  }

  return [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.BETTER_AUTH_URL,
  ].filter(isDefined);
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
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
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  },
  trustedOrigins: getTrustedOrigins(),
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

export type AuthRequest<T extends FnRequest = FnRequest> = T & {
  email: string;
};

export const loggedIn = async <T extends FnRequest>(
  req: T,
  res: (data: Response) => RouterResponse,
) => {
  // Get session from Better Auth using request headers
  const session = await auth.api.getSession({
    headers: req.headers,
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

export const secured = async <T extends ClubRequest>(
  req: T,
  res: (data: Response) => RouterResponse,
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
