import { HandlerResponse } from "@netlify/functions";
import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";

import { dialect } from "./database.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";
import { unauthorized } from "./responses";
import { isRouterResponse, Request, RouterResponse } from "./router";
import { ClubRequest } from "./validation";
import {
  ensure,
  filterUndefinedProperties,
  isDefined,
} from "../../../lib/checks/checks.js";
import ClubRepository from "../repositories/ClubRepository";

const googleClientId = ensure(
  process.env.GOOGLE_CLIENT_ID,
  "GOOGLE_CLIENT_ID is not set",
);
const googleClientSecret = ensure(
  process.env.GOOGLE_CLIENT_SECRET,
  "GOOGLE_CLIENT_SECRET is not set",
);

/**
 * Extracts the Netlify site identifier from a URL.
 * Returns null if the URL is not a Netlify URL.
 * Example: "https://cobresun-movie-club.netlify.app" -> "cobresun-movie-club"
 */
function extractNetlifySiteFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    if (!hostname.endsWith(".netlify.app")) {
      return null; // Not a Netlify URL (custom domain)
    }
    // Extract 'cobresun-movie-club' from 'cobresun-movie-club.netlify.app'
    return hostname.replace(".netlify.app", "");
  } catch {
    return null;
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.DEPLOY_PRIME_URL || process.env.URL,
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
  trustedOrigins: async (request) => {
    // Base trusted origins - ALWAYS include DEPLOY_PRIME_URL!
    const baseOrigins = [
      process.env.URL,
      process.env.DEPLOY_PRIME_URL,
      process.env.BETTER_AUTH_URL,
    ].filter(isDefined);

    // Handle undefined request (occurs during auth.api calls)
    if (!request) {
      return baseOrigins;
    }

    // Extract origin from request headers
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);

    if (!requestOrigin) {
      return baseOrigins;
    }

    // Start with base trusted origins
    const trusted = [...baseOrigins];

    // Always trust localhost for development
    if (requestOrigin.startsWith("http://localhost:")) {
      if (!trusted.includes(requestOrigin)) {
        trusted.push(requestOrigin);
      }
      return trusted;
    }

    // Extract Netlify site identifier (if URL is a Netlify URL)
    const siteIdentifier = extractNetlifySiteFromUrl(process.env.URL);

    // If we have a site identifier, validate that the request origin matches our site
    if (siteIdentifier && requestOrigin.includes(`${siteIdentifier}.netlify.app`)) {
      if (!trusted.includes(requestOrigin)) {
        trusted.push(requestOrigin);
      }
    }

    return trusted;
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
