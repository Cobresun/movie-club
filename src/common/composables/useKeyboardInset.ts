import { onScopeDispose, readonly, ref } from "vue";

/**
 * Below this, a viewport shrink is something other than a keyboard — an
 * address bar collapsing, a toolbar sliding in.
 */
const KEYBOARD_MIN_HEIGHT = 120;

/**
 * Tracks how much of the layout viewport the on-screen keyboard covers, plus
 * the height of what's left visible.
 *
 * Mobile browsers disagree about what a keyboard does. iOS Safari leaves the
 * layout viewport alone and scrolls the *visual* viewport instead, which shoves
 * `position: fixed` elements up off the screen; Android Chrome shrinks the
 * visual viewport in place. `visualViewport` describes both: whatever of
 * `window.innerHeight` the visible area and its offset don't account for is the
 * space the keyboard has taken.
 *
 * Returns `0` where `visualViewport` is unavailable (jsdom, older browsers), so
 * callers fall back to their normal layout.
 */
export function useKeyboardInset() {
  const keyboardInset = ref(0);
  const viewportHeight = ref(0);

  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;

  if (viewport) {
    const update = () => {
      const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
      keyboardInset.value = covered > KEYBOARD_MIN_HEIGHT ? Math.round(covered) : 0;
      viewportHeight.value = Math.round(viewport.height);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    onScopeDispose(() => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    });
  }

  return { keyboardInset: readonly(keyboardInset), viewportHeight: readonly(viewportHeight) };
}
