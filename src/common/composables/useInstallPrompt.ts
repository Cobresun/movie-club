import { computed, ref, shallowRef } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";
import { isIosDevice } from "./useShare";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

const isInstallPromptEvent = (event: Event): event is BeforeInstallPromptEvent =>
  "prompt" in event && typeof event.prompt === "function";

const DISMISSED_KEY = "installPromptDismissed";

const deferredPrompt = shallowRef<BeforeInstallPromptEvent>();

// Chrome fires `beforeinstallprompt` once, shortly after the page loads, and
// usually before any club page has mounted, so it is captured at import time
// and held until the banner asks for it.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!isInstallPromptEvent(event)) return;
    event.preventDefault();
    deferredPrompt.value = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt.value = undefined;
  });
}

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && navigator.standalone === true);

const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
};

export type InstallMode = "prompt" | "ios";

/**
 * How this browser can add Movie Club to the home screen: `"prompt"` when
 * Chrome offered its own install dialog, `"ios"` when the only route is
 * the Share menu, and `undefined` when there is nothing to offer (already
 * installed, dismissed, or a browser that supports neither).
 */
export function useInstallPrompt() {
  const dismissed = ref(readDismissed());

  const mode = computed<InstallMode | undefined>(() => {
    if (dismissed.value || isStandalone()) return undefined;
    if (isDefined(deferredPrompt.value)) return "prompt";
    return isIosDevice() ? "ios" : undefined;
  });

  const install = async (): Promise<void> => {
    const event = deferredPrompt.value;
    if (!isDefined(event)) return;
    // A captured prompt can only be shown once.
    deferredPrompt.value = undefined;
    await event.prompt();
  };

  const dismiss = (): void => {
    dismissed.value = true;
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Without storage the banner returns on the next load, which is harmless.
    }
  };

  return { mode, install, dismiss };
}
