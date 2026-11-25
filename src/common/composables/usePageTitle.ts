import { onUnmounted, toValue, watchEffect, type MaybeRefOrGetter } from "vue";

const SITE_TITLE = "Movie Club";

/** Names the browser tab after the page while it is shown. */
export function usePageTitle(title: MaybeRefOrGetter<string | undefined>) {
  watchEffect(() => {
    document.title = toValue(title) ?? SITE_TITLE;
  });
  onUnmounted(() => {
    document.title = SITE_TITLE;
  });
}
