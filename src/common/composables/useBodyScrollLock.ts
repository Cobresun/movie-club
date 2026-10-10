import { onUnmounted, watch } from "vue";
import type { Ref } from "vue";

// Overlays stack (the score-entry sheet opens over the work-details sheet), so
// the lock is counted: the page only scrolls again once the last overlay
// holding it lets go, rather than when the top one closes.
let lockCount = 0;
let restoreStyles: (() => void) | undefined;

const acquire = () => {
  lockCount++;
  if (lockCount > 1) return;

  const { style } = document.body;
  const previous = { overflow: style.overflow, paddingRight: style.paddingRight };
  // Hiding a classic (non-overlay) scrollbar widens the page, shifting the
  // content behind the overlay sideways; pad the width it took back in.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  style.overflow = "hidden";
  if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;

  restoreStyles = () => {
    style.overflow = previous.overflow;
    style.paddingRight = previous.paddingRight;
  };
};

const release = () => {
  lockCount--;
  if (lockCount > 0) return;
  restoreStyles?.();
  restoreStyles = undefined;
};

/**
 * Composable to manage body scroll locking for modals, drawers, and bottom sheets.
 *
 * @param isOpen - Reactive boolean indicating if the component is open
 * @param shouldLock - Optional reactive boolean to conditionally enable scroll lock (e.g., only on mobile)
 *
 * @example
 * // Lock body scroll when drawer is open on mobile only
 * const isDrawerOpen = ref(false);
 * const isMobile = ref(false);
 * useBodyScrollLock(isDrawerOpen, isMobile);
 *
 * @example
 * // Always lock body scroll when modal is open
 * const isModalOpen = ref(false);
 * useBodyScrollLock(isModalOpen);
 */
export function useBodyScrollLock(isOpen: Ref<boolean>, shouldLock?: Ref<boolean>) {
  let held = false;

  const update = () => {
    const wanted = isOpen.value && (shouldLock?.value ?? true);
    if (wanted === held) return;
    held = wanted;
    if (wanted) acquire();
    else release();
  };

  watch([isOpen, () => shouldLock?.value], update);
  update();

  onUnmounted(() => {
    if (!held) return;
    held = false;
    release();
  });
}
