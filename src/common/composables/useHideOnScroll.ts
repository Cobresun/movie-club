import { onMounted, onUnmounted, ref } from "vue";

interface HideOnScrollOptions {
  /** Pixels of travel in one direction before the state flips. Kills jitter. */
  threshold?: number;
  /** The bar always stays visible while the page is scrolled less than this. */
  revealOffset?: number;
}

/**
 * Tracks scroll direction to hide a fixed bar while the user scrolls down and
 * bring it back the moment they scroll up.
 *
 * Deltas are accumulated rather than compared frame-to-frame so that a shaky
 * finger (or momentum overshoot) can't flap the bar in and out: the state only
 * flips once travel in the new direction passes `threshold`.
 *
 * The bar is pinned visible near the top and at the very bottom of the page —
 * at the bottom there is nothing left to reveal by hiding it, and iOS
 * rubber-banding would otherwise leave it stuck away.
 *
 * Under `prefers-reduced-motion` it never hides at all: the global motion layer
 * collapses transition durations, so hiding would be an abrupt jump rather than
 * a slide.
 */
export function useHideOnScroll({ threshold = 8, revealOffset = 24 }: HideOnScrollOptions = {}) {
  const isHidden = ref(false);

  let lastScrollY = 0;
  let travel = 0;

  const reveal = () => {
    isHidden.value = false;
    travel = 0;
  };

  const handleScroll = () => {
    // iOS overscroll reports negative scrollY / past-the-end values.
    const currentScrollY = Math.max(0, window.scrollY);
    const delta = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;

    if (delta === 0) return;

    const atBottom =
      window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - 1;

    if (currentScrollY <= revealOffset || atBottom) {
      reveal();
      return;
    }

    // Reset the tally whenever direction changes so travel is always measured
    // from the turning point.
    travel = Math.sign(travel) === Math.sign(delta) ? travel + delta : delta;

    if (travel > threshold) {
      isHidden.value = true;
    } else if (travel < -threshold) {
      isHidden.value = false;
    }
  };

  onMounted(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    lastScrollY = Math.max(0, window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", handleScroll);
  });

  return { isHidden, reveal };
}
