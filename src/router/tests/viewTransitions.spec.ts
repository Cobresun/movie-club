import { createMemoryHistory, createRouter } from "vue-router";

import { installViewTransitions } from "../viewTransitions";

vi.unmock("vue-router");

const page = { template: "<div />" };

const createTestRouter = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/reviews", name: "Reviews", component: page },
      { path: "/lists", name: "Watchlists", component: page },
    ],
  });
  installViewTransitions(router);
  return router;
};

describe("route view transitions", () => {
  let router: ReturnType<typeof createTestRouter>;
  let pagesCaptured: string[] = [];
  const capturePage = () => pagesCaptured.push(String(router.currentRoute.value.name));

  beforeEach(async () => {
    pagesCaptured = [];
    router = createTestRouter();
    await router.push("/reviews");
    // Plays the browser's part: the old page is captured before the update
    // callback runs, and the new page once the promise it returns settles.
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (update: () => Promise<void>) => {
        capturePage();
        const updateCallbackDone = Promise.resolve()
          .then(update)
          .then(() => capturePage());
        return { updateCallbackDone, ready: updateCallbackDone, finished: updateCallbackDone };
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("animates from the old page to the new one", async () => {
    await router.push("/lists");
    await vi.waitFor(() => expect(pagesCaptured).toHaveLength(2));

    expect(router.currentRoute.value.name).toBe("Watchlists");
    expect(pagesCaptured).toEqual(["Reviews", "Watchlists"]);
  });

  it("leaves a query change on the same page unanimated", async () => {
    await router.push({ path: "/reviews", query: { sort: "score" } });

    expect(router.currentRoute.value.query.sort).toBe("score");
    expect(pagesCaptured).toEqual([]);
  });
});
