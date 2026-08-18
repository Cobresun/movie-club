import { describe, expect, it } from "vitest";

import { toDeployLink } from "../deployLinks";

const PRODUCTION = "https://movie-club.app";
const PREVIEW = "https://deploy-preview-123--movieclub.netlify.app";

// The shape BetterAuth builds from `baseURL`: its own route, the token in the
// path, and the client-supplied callbackURL — already pointing at the preview,
// because the browser sent its own origin — carried through the query.
const resetLink = (origin: string, callbackOrigin: string) =>
  `${origin}/api/auth/reset-password/tok-123?callbackURL=${encodeURIComponent(
    `${callbackOrigin}/reset-password`,
  )}`;

describe("toDeployLink", () => {
  it("re-points a production link at the preview that issued the token", () => {
    const link = toDeployLink(resetLink(PRODUCTION, PREVIEW), PREVIEW);

    expect(new URL(link).origin).toBe(PREVIEW);
  });

  it("keeps the path and query BetterAuth built", () => {
    const link = new URL(toDeployLink(resetLink(PRODUCTION, PREVIEW), PREVIEW));

    expect(link.pathname).toBe("/api/auth/reset-password/tok-123");
    expect(link.searchParams.get("callbackURL")).toBe(`${PREVIEW}/reset-password`);
  });

  it("is a no-op when the deploy is the production site", () => {
    const original = resetLink(PRODUCTION, PRODUCTION);

    expect(toDeployLink(original, PRODUCTION)).toBe(original);
  });

  it("follows the deploy's scheme and port, so localhost stays reachable", () => {
    const link = toDeployLink(
      resetLink(PRODUCTION, "http://localhost:8888"),
      "http://localhost:8888",
    );

    expect(new URL(link).origin).toBe("http://localhost:8888");
  });

  it("leaves the link alone when no deploy URL is configured", () => {
    const original = resetLink(PRODUCTION, PREVIEW);

    expect(toDeployLink(original, undefined)).toBe(original);
    expect(toDeployLink(original, "")).toBe(original);
  });

  it("leaves the link alone when the deploy URL cannot be parsed", () => {
    const original = resetLink(PRODUCTION, PREVIEW);

    expect(toDeployLink(original, "not-a-url")).toBe(original);
  });
});
