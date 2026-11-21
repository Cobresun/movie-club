import { computed, onScopeDispose, ref } from "vue";

/**
 * Below this, a viewport shrink is something other than a keyboard — an
 * address bar collapsing, a toolbar sliding in.
 */
const KEYBOARD_MIN_HEIGHT = 120;

const isField = (el: Element | null) =>
  el?.matches("input, textarea, select, [contenteditable]") ?? false;

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
 * The keyboard counts as closed as soon as no field has focus. iOS reports the
 * viewport growing back only once the keyboard has finished sliding away, and
 * sometimes not until well after, so waiting for it leaves layouts sitting
 * where the keyboard was.
 *
 * Returns `0` where `visualViewport` is unavailable (jsdom, older browsers), so
 * callers fall back to their normal layout.
 */
export function useKeyboardInset() {
  const covered = ref(0);
  const viewportHeight = ref(0);
  const pan = ref(0);
  const fieldFocused = ref(false);

  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;

  if (viewport) {
    const update = () => {
      covered.value = Math.round(window.innerHeight - viewport.height);
      viewportHeight.value = Math.round(viewport.height);
      pan.value = Math.round(viewport.offsetTop);
    };
    // Focus moving between two fields fires `focusout` then `focusin` in the
    // same task, so the keyboard never reads as closed in between.
    const updateFocus = () => {
      fieldFocused.value = isField(document.activeElement);
    };

    update();
    updateFocus();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", updateFocus);
    document.addEventListener("focusout", updateFocus);

    onScopeDispose(() => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", updateFocus);
      document.removeEventListener("focusout", updateFocus);
    });
  }

  const open = computed(() => fieldFocused.value && covered.value > KEYBOARD_MIN_HEIGHT);

  return {
    keyboardInset: computed(() => (open.value ? covered.value : 0)),
    viewportHeight: computed(() => viewportHeight.value),
    viewportOffset: computed(() => (open.value ? pan.value : 0)),
  };
}
