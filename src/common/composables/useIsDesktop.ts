import { onMounted, onUnmounted, ref } from "vue";

export function useIsDesktop() {
  const isDesktop = ref(false);
  let mediaQuery: MediaQueryList | null = null;

  const updateMedia = (e: MediaQueryListEvent | MediaQueryList) => {
    isDesktop.value = e.matches;
  };

  onMounted(() => {
    mediaQuery = window.matchMedia("(min-width: 768px)");
    updateMedia(mediaQuery);

    mediaQuery.addEventListener("change", updateMedia);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener("change", updateMedia);
  });
  return isDesktop;
}
