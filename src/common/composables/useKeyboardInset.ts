import { onScopeDispose, readonly, ref } from "vue";

/**
 * Below this, a viewport shrink is something other than a keyboard — an
 * address bar collapsing, a toolbar sliding in.
 */
const KEYBOARD_MIN_HEIGHT = 120;

/**
 * Tracks how much of the layout viewport the on-screen keyboard covers, the
 * height of what's left visible, and how far that visible area is panned.
 *
 * Mobile browsers disagree about what a keyboard does. iOS Safari leaves the
 * layout viewport alone and pans the *visual* viewport over it, carrying
 * `position: fixed` elements along with the page; Android Chrome shrinks the
 * visual viewport in place. `visualViewport` describes both: whatever of
 * `window.innerHeight` the visible area doesn't take is the keyboard, and its
 * `offsetTop` is the pan.
 *
 * The keyboard and the pan are reported apart because they move differently:
 * the keyboard opens once, while iOS pans back and forth as the caret moves.
 *
 * Returns `0` where `visualViewport` is unavailable (jsdom, older browsers), so
 * callers fall back to their normal layout.
 */
export function useKeyboardInset() {
  const keyboardInset = ref(0);
  const viewportHeight = ref(0);
  const viewportOffset = ref(0);

  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;

  if (viewport) {
    const update = () => {
      const covered = window.innerHeight - viewport.height;
      const open = covered > KEYBOARD_MIN_HEIGHT;
      keyboardInset.value = open ? Math.round(covered) : 0;
      viewportHeight.value = Math.round(viewport.height);
      viewportOffset.value = open ? Math.round(viewport.offsetTop) : 0;
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    onScopeDispose(() => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    });
  }

  return {
    keyboardInset: readonly(keyboardInset),
    viewportHeight: readonly(viewportHeight),
    viewportOffset: readonly(viewportOffset),
  };
}
