import { nextTick } from "vue";
import type { Router } from "vue-router";

import { isDefined, isTrue } from "../../lib/checks/checks.js";

/**
 * Crossfades every route change with the View Transitions API. The browser
 * snapshots the old page before the route commits and animates to the new one
 * once it has rendered, so the two pages never share the DOM. Browsers without
 * the API swap instantly.
 */
export function installViewTransitions(router: Router) {
  let browserAnimatedTraversal = false;
  let finishTransition: (() => void) | undefined;

  const finish = () => {
    finishTransition?.();
    finishTransition = undefined;
  };

  // Capture phase, so the flag is set before vue-router's own popstate listener
  // starts the navigation. Safari and Chrome on Android play their own
  // animation for a swipe back/forward, and ours on top would replay it.
  window.addEventListener(
    "popstate",
    (event) => {
      browserAnimatedTraversal = isTrue(event.hasUAVisualTransition);
    },
    { capture: true },
  );

  router.beforeResolve((to, from) => {
    const skip =
      !("startViewTransition" in document) ||
      browserAnimatedTraversal ||
      !isDefined(from.name) ||
      // Query changes and the history entries overlays push (useBackButtonClose)
      // keep the path; only a new page should animate.
      to.path === from.path ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    browserAnimatedTraversal = false;
    finish();
    if (skip) return;

    // Resolving once the update callback runs lets the navigation commit only
    // after the old page has been captured; the returned promise holds the
    // new snapshot until afterEach, when the new page has rendered.
    return new Promise<void>((snapshotTaken) => {
      document.startViewTransition(() => {
        snapshotTaken();
        return new Promise<void>((resolve) => {
          finishTransition = resolve;
        });
      });
    });
  });

  router.afterEach(async () => {
    await nextTick();
    finish();
  });
  router.onError(finish);
}
