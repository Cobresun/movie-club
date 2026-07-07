import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";

/**
 * Lets the browser back button (and the mobile back gesture) dismiss an overlay
 * such as a bottom sheet or modal.
 *
 * On mount we push an extra history entry (keeping the same URL so no real
 * navigation happens). Pressing back pops that entry and fires `popstate`,
 * which we translate into a dismissal via `onDismiss`. When the overlay is
 * closed by any other means (grabber, backdrop, escape, etc.), the pushed entry
 * is removed on unmount so a later back press is not "swallowed" by a stale
 * entry.
 *
 * If instead the overlay closes because the app *navigated* while it was open
 * (for example the mobile club switcher routing to the chosen club), vue-router
 * has already pushed a real history entry above our synthetic one. Reclaiming
 * ours with `history.back()` would then traverse back over that real entry and
 * cancel the navigation, so in that case we leave history untouched.
 *
 * ## Stacked overlays
 *
 * When one overlay opens on top of another (e.g. the Score Assist modal over
 * the work-details bottom sheet), both push a synthetic entry. If the top one
 * closes via a *non-back* action, its cleanup `history.back()` pops its own
 * entry — but that `popstate` is also heard by the lower overlay's still-live
 * listener, which would otherwise mistake it for a user back press and dismiss
 * itself too. To prevent that, a closing overlay whose pop will land on a lower
 * overlay flags the resulting `popstate` as synthetic so the lower overlay
 * swallows exactly that one event and stays open. (Coordinates the common
 * two-overlay case; deeper stacks are not exercised in this app.)
 *
 * @param onDismiss - Called when the back button should close the overlay.
 *
 * @example
 * useBackButtonClose(() => handleClose());
 */

// Overlays currently holding a synthetic history entry with a live listener.
let mountedOverlays = 0;
// Synthetic cleanup pops (from a higher overlay closing) that the next popstate
// handler should ignore rather than treat as a user back press.
let syntheticPopsToIgnore = 0;

export function useBackButtonClose(onDismiss: () => void) {
  // Whether our extra history entry is still on the stack and needs cleanup.
  let pushed = false;
  // Set once a route navigation starts while the overlay is open. Popping our
  // entry afterwards would undo that navigation, so we skip the cleanup.
  let navigated = false;

  // `useRouter()` is undefined outside a router context (e.g. bare unit tests);
  // guard so those callers keep the original cleanup behaviour.
  const router = useRouter();
  let removeGuard: (() => void) | undefined;

  const onPopState = () => {
    // A synthetic pop from a higher overlay's cleanup, not a user back press —
    // swallow it and leave this overlay (and its entry) in place.
    if (syntheticPopsToIgnore > 0) {
      syntheticPopsToIgnore--;
      return;
    }
    // The browser has already popped our entry, so don't pop it again on
    // unmount — just dismiss the overlay.
    pushed = false;
    mountedOverlays--;
    onDismiss();
  };

  onMounted(() => {
    // Spread the existing state so vue-router's internal state is preserved,
    // and omit the URL so the address bar (and current route) stay put.
    window.history.pushState({ ...window.history.state, vOverlay: true }, "");
    pushed = true;
    mountedOverlays++;
    window.addEventListener("popstate", onPopState);
    // Flag any navigation that happens while the overlay is open. Callers that
    // navigate from an in-overlay action are expected to close the overlay only
    // after the navigation resolves (see ClubSwitcher), so this is already set
    // by the time the resulting unmount runs its cleanup.
    removeGuard = router?.beforeEach(() => {
      navigated = true;
    });
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", onPopState);
    removeGuard?.();
    if (!pushed) return;
    pushed = false;
    mountedOverlays--;
    if (navigated) return;
    // If a lower overlay is still mounted, our history.back() will reach its
    // listener as a popstate it must not treat as a dismissal.
    if (mountedOverlays > 0) {
      syntheticPopsToIgnore++;
    }
    // Remove the entry we added so the back button isn't consumed by it after
    // the overlay has already been dismissed some other way.
    window.history.back();
  });
}
