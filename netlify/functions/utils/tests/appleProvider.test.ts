import { describe, expect, it } from "vitest";

import { appleProviderOptions } from "../appleProvider";

const BASE = "https://movie-club.app";

describe("appleProviderOptions", () => {
  it("leaves Apple disabled when no client ID is configured", () => {
    expect(appleProviderOptions({ BETTER_AUTH_URL: BASE })).toBeUndefined();
    expect(appleProviderOptions({ APPLE_CLIENT_ID: "", BETTER_AUTH_URL: BASE })).toBeUndefined();
  });

  it("accepts ID tokens issued to both the Services ID and the iOS bundle ID", () => {
    const options = appleProviderOptions({
      APPLE_CLIENT_ID: "app.movieclub.web",
      APPLE_CLIENT_SECRET: "secret",
      APPLE_APP_BUNDLE_IDENTIFIER: "app.movieclub.ios",
      BETTER_AUTH_URL: BASE,
    });

    expect(options?.audience).toEqual(["app.movieclub.web", "app.movieclub.ios"]);
    expect(options?.redirectURI).toBe(`${BASE}/api/auth/callback/apple`);
  });

  it("accepts only the Services ID when no bundle ID is configured", () => {
    const options = appleProviderOptions({
      APPLE_CLIENT_ID: "app.movieclub.web",
      BETTER_AUTH_URL: BASE,
    });

    expect(options?.audience).toEqual(["app.movieclub.web"]);
  });
});
