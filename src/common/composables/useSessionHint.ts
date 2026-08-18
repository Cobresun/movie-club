const SIGNED_IN_HINT_KEY = "wasSignedIn";

/**
 * Whether the last session this browser resolved was a signed-in one.
 *
 * A cold load can't know where it is headed: the session check is a round
 * trip, and until it comes back the app can't tell a club home from the
 * logged-out landing page. This is the guess it makes in the meantime, and it
 * decides one thing only — which placeholder to paint. The real session
 * corrects it a few hundred milliseconds later either way, so the cost of a
 * wrong guess (a session that expired since the last visit) is one flash of
 * the wrong skeleton, self-corrected for the next load.
 */
export function getSignedInHint(): boolean {
  return localStorage.getItem(SIGNED_IN_HINT_KEY) === "true";
}

export function setSignedInHint(signedIn: boolean): void {
  if (signedIn) {
    localStorage.setItem(SIGNED_IN_HINT_KEY, "true");
  } else {
    localStorage.removeItem(SIGNED_IN_HINT_KEY);
  }
}
