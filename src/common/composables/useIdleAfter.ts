import { onBeforeUnmount, readonly, ref, type Ref, watch } from "vue";

import { isDefined } from "../../../lib/checks/checks";

/**
 * Turns true once `ready` holds and the browser has then gone idle, so work a
 * page does not need for its first paint waits until after it. Waiting on
 * `ready` first matters: while a page's own requests are in flight the main
 * thread sits idle, so an idle callback armed on mount would fire alongside
 * them.
 */
export function useIdleAfter(ready: () => boolean): Readonly<Ref<boolean>> {
  const idle = ref(false);
  let cancel: (() => void) | undefined;

  const stop = watch(
    ready,
    (isReady) => {
      if (!isReady || isDefined(cancel)) return;
      const arrive = () => {
        idle.value = true;
      };
      if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(arrive, { timeout: 2000 });
        cancel = () => window.cancelIdleCallback(handle);
      } else {
        // Safari/jsdom: no requestIdleCallback; a short delay clears the
        // render that `ready` set off instead.
        const handle = setTimeout(arrive, 300);
        cancel = () => clearTimeout(handle);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stop();
    cancel?.();
  });

  return readonly(idle);
}
