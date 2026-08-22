const SIGNED_IN_HINT_KEY = "wasSignedIn";

/**
 * `localStorage` is not always there to be read. It is missing outside a
 * browser (the watcher that keeps the hint honest can flush after a test's
 * DOM has been torn down) and it throws outright when a browser has site
 * data blocked. The hint is a guess about which placeholder to paint, so
 * losing it costs one flash — never an error.
 */
function withStorage<T>(fallback: T, use: (storage: Storage) => T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return use(localStorage);
  } catch {
    return fallback;
  }
}

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
  return withStorage(false, (storage) => storage.getItem(SIGNED_IN_HINT_KEY) === "true");
}

export function setSignedInHint(signedIn: boolean): void {
  withStorage(undefined, (storage) => {
    if (signedIn) {
      storage.setItem(SIGNED_IN_HINT_KEY, "true");
    } else {
      storage.removeItem(SIGNED_IN_HINT_KEY);
    }
  });
}
