import { loadRouteLocation, type Router } from "vue-router";

import { isDefined } from "../../lib/checks/checks.js";
import { CLUB_SECTIONS } from "../common/clubSections";

/**
 * Most section views are split into their own chunks, and Statistics carries
 * the charting library. vue-router downloads a lazy view before it commits the
 * navigation, so the first tap on a section tab showed nothing until that
 * download finished. Fetch every section once the first club page is up and
 * the browser has gone idle.
 */
export function installClubSectionPreload(router: Router) {
  const removeHook = router.afterEach((to, _from, failure) => {
    const clubSlug = to.params.clubSlug;
    if (isDefined(failure) || typeof clubSlug !== "string") return;
    removeHook();

    whenIdle(() => {
      for (const section of CLUB_SECTIONS) {
        loadRouteLocation(router.resolve({ name: section.name, params: { clubSlug } })).catch(
          console.error,
        );
      }
    });
  });
}

function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    // Let the page's own data requests go first, but don't wait indefinitely.
    window.requestIdleCallback(callback, { timeout: 2000 });
  } else {
    // Safari has no requestIdleCallback.
    setTimeout(callback, 1000);
  }
}
