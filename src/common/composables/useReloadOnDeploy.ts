import { onBeforeUnmount, onMounted } from "vue";
import { z } from "zod";

import { http } from "@/common/http";

/** Written by the build next to index.html (`vite.config.ts`). */
const DEPLOY_PATH = "/version.json";

const deploySchema = z.object({ buildId: z.string() });

// Anything but a readable, different id (no file under `vite`, a network
// error, the SPA fallback's HTML) leaves the page as it is.
async function newerDeployIsLive(): Promise<boolean> {
  try {
    const { data } = await http.get(DEPLOY_PATH);
    const deploy = deploySchema.safeParse(data);
    return deploy.success && deploy.data.buildId !== __BUILD_ID__;
  } catch {
    return false;
  }
}

/**
 * Reloads a page left open across a deploy when it comes back into view.
 *
 * Such a page keeps running the app it loaded, against an API that has moved
 * on, so a response whose shape changed renders wrong until the visitor
 * reloads, and a phone can keep a tab alive for days. A lazy route chunk the
 * new deploy no longer has fails to load for the same reason.
 */
export function useReloadOnDeploy() {
  const reloadIfStale = () => {
    void newerDeployIsLive().then((stale) => {
      if (stale) window.location.reload();
    });
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") reloadIfStale();
  };

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("vite:preloadError", reloadIfStale);
  });
  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("vite:preloadError", reloadIfStale);
  });
}
