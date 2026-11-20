import { http, HttpResponse } from "msw";

import { useReloadOnDeploy } from "@/common/composables/useReloadOnDeploy";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

const reload = vi.fn();

const deployed = (buildId: string) =>
  server.use(http.get("/version.json", () => HttpResponse.json({ buildId })));

const returnToTab = () => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

// Returns to the tab and settles once the page has read `response`, so a test
// can check that nothing followed.
const afterAnswering = async (response: Response) => {
  const { promise: answered, resolve } = Promise.withResolvers<void>();
  server.use(
    http.get("/version.json", () => {
      resolve();
      return response;
    }),
  );
  returnToTab();
  await answered;
  await new Promise((settle) => {
    setTimeout(settle);
  });
};

describe("useReloadOnDeploy", () => {
  let unmount: () => void;

  beforeEach(() => {
    reload.mockClear();
    vi.stubGlobal("location", { href: window.location.href, reload });
    ({ unmount } = withSetup(useReloadOnDeploy));
  });

  afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
  });

  it("reloads a page that comes back into view after a newer deploy", async () => {
    deployed("a-newer-build");
    returnToTab();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it("reloads when a route's code is gone after a newer deploy", async () => {
    deployed("a-newer-build");
    window.dispatchEvent(new Event("vite:preloadError"));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });

  it("leaves a page on the live deploy as it is", async () => {
    await afterAnswering(HttpResponse.json({ buildId: __BUILD_ID__ }));
    expect(reload).not.toHaveBeenCalled();
  });

  it("leaves the page as it is when the deploy can't be read", async () => {
    await afterAnswering(HttpResponse.text("<!doctype html>"));
    expect(reload).not.toHaveBeenCalled();
  });
});
