import { onMounted, onUnmounted, ref } from "vue";

/**
 * Composable that tracks the visual viewport height.
 * This is useful for handling on-screen keyboards on mobile devices,
 * as the visual viewport shrinks when the keyboard appears.
 */
export function useVisualViewport() {
  const viewportHeight = ref<number | null>(null);

  const updateViewport = () => {
    if (window.visualViewport) {
      viewportHeight.value = window.visualViewport.height;
    }
  };

  onMounted(() => {
    if (window.visualViewport) {
      updateViewport();
      window.visualViewport.addEventListener("resize", updateViewport);
    }
  });

  onUnmounted(() => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", updateViewport);
    }
  });

  return { viewportHeight };
}
