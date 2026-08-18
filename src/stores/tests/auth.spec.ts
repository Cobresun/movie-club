import { http, HttpResponse } from "msw";

import { server } from "@/mocks/server";

// Plain object rather than a ref: vi.hoisted runs before imports, so `ref`
// isn't available yet — and the session is signed-in from the start in these
// tests, so nothing has to react to it changing.
const { session } = vi.hoisted(() => ({
  session: {
    value: {
      data: { session: { id: "s-1" }, user: { id: "u-1" } },
      isPending: false,
      isRefetching: false,
    },
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session },
}));

/**
 * The store has to come from a fresh module registry: `src/tests/setup.ts`
 * imports it before this file's mocks are registered, so the cached copy holds
 * the REAL auth client and would never report a signed-in session. Everything
 * the store touches is re-imported alongside it so they all agree on one Vue.
 *
 * A real pinia, not createTestingPinia: these tests are about the action's own
 * behaviour, and testing pinia stubs actions out.
 */
const mountStore = async (push: () => Promise<unknown>) => {
  vi.resetModules();
  const [{ createApp }, { createPinia }, { VueQueryPlugin }, vueRouter, { useAuthStore }] =
    await Promise.all([
      import("vue"),
      import("pinia"),
      import("@tanstack/vue-query"),
      import("vue-router"),
      import("@/stores/auth"),
    ]);

  vi.mocked(vueRouter.useRouter).mockReturnValue({
    push,
    beforeEach: vi.fn(() => vi.fn()),
  } as unknown as ReturnType<typeof vueRouter.useRouter>);

  let store!: ReturnType<typeof useAuthStore>;
  const app = createApp({
    setup() {
      store = useAuthStore();
      return () => null;
    },
  });
  app.use(createPinia());
  app.use(VueQueryPlugin, {
    queryClientConfig: { defaultOptions: { queries: { retry: false } } },
  });
  app.mount(document.createElement("div"));

  return { store, unmount: () => app.unmount() };
};

describe("navigateAfterAuth", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/member/clubs", () =>
        HttpResponse.json([{ clubId: "1", clubName: "Test club", slug: "test-club" }]),
      ),
    );
  });

  it("keeps the loading gate up until the router has landed", async () => {
    // A push left pending, so the flag can be inspected in the window between
    // "clubs resolved" and "navigation complete" — the window where the app
    // used to drop the gate and paint the logged-out landing page.
    let landOnDestination!: () => void;
    const push = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          landOnDestination = resolve;
        }),
    );

    const { store, unmount } = await mountStore(push);

    const navigation = store.navigateAfterAuth();
    expect(store.isNavigatingAfterAuth).toBe(true);

    // Being called at all means the clubs query has already resolved.
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith({
      name: "ClubHome",
      params: { clubSlug: "test-club" },
    });
    expect(store.isNavigatingAfterAuth).toBe(true);

    landOnDestination();
    await navigation;
    expect(store.isNavigatingAfterAuth).toBe(false);

    unmount();
  });

  it("sends a user with no clubs to club creation", async () => {
    server.use(http.get("/api/member/clubs", () => HttpResponse.json([])));
    const push = vi.fn(() => Promise.resolve());

    const { store, unmount } = await mountStore(push);
    await store.navigateAfterAuth();

    expect(push).toHaveBeenCalledWith({ name: "NewClub" });
    expect(store.isNavigatingAfterAuth).toBe(false);

    unmount();
  });

  it("releases the gate when the navigation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const push = vi.fn(() => Promise.reject(new Error("guard rejected")));

    const { store, unmount } = await mountStore(push);
    await store.navigateAfterAuth();

    expect(store.isNavigatingAfterAuth).toBe(false);

    unmount();
  });
});
