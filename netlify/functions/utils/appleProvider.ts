import type { AppleOptions } from "better-auth/social-providers";

import { hasValue } from "../../../lib/checks/checks.js";

export const APPLE_ORIGIN = "https://appleid.apple.com";

type AppleEnv = Record<string, string | undefined>;

/**
 * Apple sign-in is optional: a deploy without `APPLE_CLIENT_ID` runs without
 * the provider rather than failing to start. The ID tokens the iOS app sends
 * are issued for the bundle ID, while the web flow's are issued for the
 * Services ID, so both are accepted audiences.
 */
export function appleProviderOptions(env: AppleEnv): AppleOptions | undefined {
  const clientId = env.APPLE_CLIENT_ID;
  if (!hasValue(clientId)) {
    return undefined;
  }

  const bundleId = env.APPLE_APP_BUNDLE_IDENTIFIER;
  return {
    clientId,
    clientSecret: env.APPLE_CLIENT_SECRET ?? "",
    appBundleIdentifier: hasValue(bundleId) ? bundleId : undefined,
    audience: hasValue(bundleId) ? [clientId, bundleId] : [clientId],
    redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/apple`,
  };
}
