import { type BetterAuthOptions } from "better-auth";

import { dialect } from "./database.js";

/**
 * What the full BetterAuth config in `auth.ts` and the session reader in
 * `session.ts` must agree on for a cookie one issues to be read by the other.
 */
export const sharedAuthOptions = {
  baseURL: process.env.BETTER_AUTH_URL,
  database: dialect,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    // Cache the session in a short-lived signed cookie so getSession() —
    // which runs on every secured request — usually skips its database
    // round trip. Sign-out still clears the cookie immediately; the tradeoff
    // is that a server-side session revocation can take up to maxAge to be
    // seen, which is acceptable at 5 minutes.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
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
} satisfies BetterAuthOptions;
