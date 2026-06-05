import { onUnmounted, watch } from "vue";
import type { Ref } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Trap keyboard focus within a container while it is active, restoring focus to
 * the previously focused element when it deactivates or the component unmounts.
 *
 * Used by overlay components (bottom sheet, modal, drawer) so that Tab cycling
 * stays inside the surface and screen-reader users are not stranded in the page
 * behind the backdrop.
 *
 * @param container - The element to trap focus within
 * @param isActive - Reactive flag that toggles the trap on/off
 *
 * @example
 * const sheetRef = ref<HTMLElement | null>(null);
 * const isOpen = ref(true);
 * useFocusTrap(sheetRef, isOpen);
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  isActive: Ref<boolean>,
) {
  let previouslyFocused: HTMLElement | null = null;

  const focusableElements = (): HTMLElement[] => {
    const root = container.value;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;

    const focusable = focusableElements();
    if (focusable.length === 0) {
      // Nothing focusable inside; keep focus on the container itself.
      event.preventDefault();
      container.value?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = () => {
    previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.addEventListener("keydown", onKeydown, true);

    // Move focus into the surface on the next tick, once its content is mounted.
    requestAnimationFrame(() => {
      const focusable = focusableElements();
      (focusable[0] ?? container.value)?.focus();
    });
  };

  const deactivate = () => {
    document.removeEventListener("keydown", onKeydown, true);
    previouslyFocused?.focus();
    previouslyFocused = null;
  };

  watch(
    isActive,
    (active) => {
      if (active) {
        activate();
      } else {
        deactivate();
      }
    },
    { immediate: true },
  );

  onUnmounted(deactivate);
}
