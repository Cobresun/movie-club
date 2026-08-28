import { VueQueryPlugin } from "@tanstack/vue-query";
import { render } from "@testing-library/vue";
import { delay, http, HttpResponse } from "msw";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import { useRouter } from "vue-router";

import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import PiniaStoreHelper from "@/tests/PiniaStoreHelper.test.vue";

const signedInSession = { session: { id: "s-1" }, user: { id: "u-1" } };

type SessionResponse = typeof signedInSession | null;

/**
 * The auth client resolves its session over the network (`customFetchImpl`
 * looks `fetch` up per call), so these tests answer the session check like any
 * other API call rather than mocking the client module.
 */
const answerSessionCheck = (body: SessionResponse) =>
  server.use(http.get("/api/auth/get-session", () => HttpResponse.json(body)));

const leaveSessionCheckPending = () =>
  server.use(http.get("/api/auth/get-session", () => delay("infinite")));

/**
 * A real pinia, not createTestingPinia: these tests are about the store's own
 * actions and computeds, and testing pinia stubs actions out. The store is
 * instantiated inside a component so the queries it builds run in a normal
 * setup context; `useAuthStore(pinia)` then hands back that same instance.
 */
const mountAuthStore = () => {
  const pinia = createPinia();
  render(PiniaStoreHelper, {
    global: {
      plugins: [
        pinia,
        // Disable query retries so error paths surface immediately instead of
        // racing the default 3x exponential backoff.
        [VueQueryPlugin, { queryClientConfig: { defaultOptions: { queries: { retry: false } } } }],
      ],
    },
  });
  return useAuthStore(pinia);
};

/** A store whose session check has come back with `body`. */
const mountWithResolvedSession = async (body: SessionResponse) => {
  answerSessionCheck(body);
  const store = mountAuthStore();
  await store.refreshSession();
  await nextTick();
  return store;
};

/** A store on a cold load, with the session check still out. */
const mountWithPendingSession = async () => {
  leaveSessionCheckPending();
  const store = mountAuthStore();
  void store.refreshSession();
  await nextTick();
  return store;
};

afterEach(() => {
  localStorage.clear();
});

describe("the signed-in hint", () => {
  it("records how the session resolved, for the next cold load", async () => {
    const store = await mountWithResolvedSession(signedInSession);

    expect(store.isLoggedIn).toBe(true);
    expect(localStorage.getItem("wasSignedIn")).toBe("true");
  });

  it("clears the hint when the session resolves signed out", async () => {
    localStorage.setItem("wasSignedIn", "true");

    const store = await mountWithResolvedSession(null);

    expect(store.isLoggedIn).toBe(false);
    expect(localStorage.getItem("wasSignedIn")).toBeNull();
  });

  it("predicts a club home for a cold load whose last session was signed in", async () => {
    localStorage.setItem("wasSignedIn", "true");

    const store = await mountWithPendingSession();

    expect(store.isAppLoading).toBe(true);
    expect(store.isLoadingClubHome).toBe(true);
  });

  it("predicts nothing for a cold load whose last session was signed out", async () => {
    // The reported bug: with no hint, a still-resolving session must not put a
    // club home on screen — the visitor may well be headed for the landing
    // page. The router still waits (isAppLoading), it just waits on a blank.
    const store = await mountWithPendingSession();

    expect(store.isAppLoading).toBe(true);
    expect(store.isLoadingClubHome).toBe(false);
  });
});

describe("navigateAfterAuth", () => {
  // The suite-wide router mock from src/tests/setup.ts, cleared between tests.
  const router = () => vi.mocked(useRouter());

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
    let landOnDestination = (): void => undefined;
    router().push.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        landOnDestination = resolve;
      }),
    );

    const store = await mountWithResolvedSession(signedInSession);

    const navigation = store.navigateAfterAuth();
    expect(store.isNavigatingAfterAuth).toBe(true);

    // Being called at all means the clubs query has already resolved.
    await vi.waitFor(() => expect(router().push.mock.calls).toHaveLength(1));
    expect(router().push.mock.calls).toContainEqual([
      { name: "ClubHome", params: { clubSlug: "test-club" } },
    ]);
    expect(store.isNavigatingAfterAuth).toBe(true);
    // What App.vue actually reads: the gate is up and it is a club home that
    // is coming, so the placeholder stays put while the route swaps under it.
    expect(store.isAppLoading).toBe(true);
    expect(store.isLoadingClubHome).toBe(true);

    landOnDestination();
    await navigation;
    expect(store.isNavigatingAfterAuth).toBe(false);
  });

  it("sends a user with no clubs to club creation", async () => {
    server.use(http.get("/api/member/clubs", () => HttpResponse.json([])));

    const store = await mountWithResolvedSession(signedInSession);
    await store.navigateAfterAuth();

    expect(router().push.mock.calls).toContainEqual([{ name: "NewClub" }]);
    expect(store.isNavigatingAfterAuth).toBe(false);
  });

  it("releases the gate when the navigation fails", async () => {
    router().push.mockImplementationOnce(() => Promise.reject(new Error("guard rejected")));

    const store = await mountWithResolvedSession(signedInSession);
    await store.navigateAfterAuth();

    expect(store.isNavigatingAfterAuth).toBe(false);
  });
});
