import { onUnmounted, watch } from "vue";
import type { Ref } from "vue";

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
export function useBodyScrollLock(
  isOpen: Ref<boolean>,
  shouldLock?: Ref<boolean>,
) {
  // Lock or unlock body scroll based on open state and condition
  const updateBodyScroll = () => {
    const shouldApplyLock = shouldLock ? shouldLock.value : true;

    if (isOpen.value && shouldApplyLock) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  };

  // Watch for changes in open state
  watch(isOpen, updateBodyScroll);
  updateBodyScroll();

  // Watch for changes in shouldLock condition if provided
  if (shouldLock) {
    watch(shouldLock, updateBodyScroll);
  }

  // Ensure body scroll is restored when component unmounts
  onUnmounted(() => {
    document.body.style.overflow = "";
  });
}
