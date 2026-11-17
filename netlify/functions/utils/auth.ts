import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { oAuthProxy } from "better-auth/plugins";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { z } from "zod";

import { ensure, isDefined } from "../../../lib/checks/checks.js";
import {
  parseCampaign,
  parseSignupSourceCookie,
  SIGNUP_CAMPAIGN_COOKIE,
  SIGNUP_SOURCE_COOKIE,
} from "../../../lib/signupSource.js";
import UserRepository from "../repositories/UserRepository";
import { sharedAuthOptions } from "./authOptions";
import { toDeployLink } from "./deployLinks.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.js";

const googleClientId = ensure(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID is not set");
const googleClientSecret = ensure(
  process.env.GOOGLE_CLIENT_SECRET,
  "GOOGLE_CLIENT_SECRET is not set",
);

const authConfigSchema = z.object({
  siteURL: z.string().url().optional(),
  trustedOrigins: z.array(z.string()),
});

type AuthConfig = z.infer<typeof authConfigSchema>;

/**
 * Written at build time by `netlify/plugins/auth-config` and bundled into the
 * function through `included_files`, because Netlify's deploy metadata is a
 * build-time concern. Absent locally, where the env vars below stand in.
 */
function readAuthConfig(): AuthConfig | undefined {
  const configPath = path.resolve("./auth-config.json");

  try {
    if (existsSync(configPath)) {
      const fileContents = readFileSync(configPath, "utf-8");
      return authConfigSchema.parse(JSON.parse(fileContents));
    }
  } catch {
    // Silent fallback to env vars for local development
  }

  return undefined;
}

const authConfig = readAuthConfig();

function getTrustedOrigins(): string[] {
  if (isDefined(authConfig)) {
    return authConfig.trustedOrigins;
  }

  return [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.BETTER_AUTH_URL].filter(
    isDefined,
  );
}

/**
 * The origin this deploy actually answers on — the per-PR URL on a deploy
 * preview, the site URL in production. `baseURL` below cannot serve that role:
 * it stays pinned to the production URL so Google OAuth keeps landing on the
 * one redirect URI registered with Google, which is why emailed links need
 * `toDeployLink`. Falling back to `BETTER_AUTH_URL` makes that rewrite a no-op,
 * which is right in production and under `netlify dev`.
 */
const deployURL = authConfig?.siteURL ?? process.env.BETTER_AUTH_URL;

export const auth = betterAuth({
  plugins: [
    oAuthProxy({
      // productionURL defaults to BETTER_AUTH_URL env var
      // currentURL auto-detected from Netlify env (URL, DEPLOY_PRIME_URL)
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, toDeployLink(url, deployURL), user.name);
    },
    password: {
      hash: (password: string) => bcrypt.hash(password, 10),
      verify: ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, toDeployLink(url, deployURL), user.name);
    },
  },
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      redirectURI: `${process.env.BETTER_AUTH_URL}/api/auth/callback/google`,
    },
  },
  trustedOrigins: getTrustedOrigins(),
  databaseHooks: {
    user: {
      create: {
        // An `after` hook writing through the repository, rather than a
        // BetterAuth additionalField, keeps the column out of the session user
        // every client receives. A failure is logged, not thrown: losing one
        // signup's attribution is better than losing the signup.
        after: async (user, context) => {
          const landing = parseSignupSourceCookie(
            context?.getCookie(SIGNUP_SOURCE_COOKIE) ?? undefined,
          );
          if (landing === undefined) {
            return;
          }
          const campaign = parseCampaign(context?.getCookie(SIGNUP_CAMPAIGN_COOKIE));
          try {
            await UserRepository.setSignupSource(user.id, landing, campaign);
          } catch (error) {
            console.error("Failed to record signup source", error);
          }
        },
      },
    },
  },
  ...sharedAuthOptions,
});
