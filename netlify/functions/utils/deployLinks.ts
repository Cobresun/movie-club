import { hasValue } from "../../../lib/checks/checks.js";

/**
 * Re-points a link BetterAuth generated at the deploy that generated it.
 *
 * BetterAuth builds the links it emails — password reset, email verification —
 * from `baseURL`, which is pinned to `BETTER_AUTH_URL` so Google OAuth keeps
 * landing on the single redirect URI registered with Google. On a deploy
 * preview that aims those links at production, where the flow cannot possibly
 * work: the token was written to the preview's own database (see the
 * `preview-database` plugin), and the preview origin the link carries as its
 * `callbackURL` is not a trusted origin there either.
 *
 * Swapping in the deploy's own origin keeps the path and query BetterAuth
 * built, so the token is redeemed against the database that holds it. In
 * production the two origins are the same and this is a no-op.
 */
export function toDeployLink(link: string, deployURL: string | undefined): string {
  if (!hasValue(deployURL)) {
    return link;
  }

  try {
    const target = new URL(link);
    const deploy = new URL(deployURL);
    target.protocol = deploy.protocol;
    target.host = deploy.host;
    return target.toString();
  } catch {
    // A link or deploy URL we can't parse is better sent as-is than dropped.
    return link;
  }
}
