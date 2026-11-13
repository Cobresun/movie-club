import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { render, waitFor } from "@testing-library/vue";
import { delay, http, HttpResponse } from "msw";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";

import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import PiniaStoreHelper from "@/tests/PiniaStoreHelper.test.vue";

const member = { id: "u-1", email: "ada@example.com", name: "Ada", image: null };
const signedInSession = { session: { id: "s-1" }, user: member };

/** What a browser holds after a session resolved signed in as `member`. */
const rememberMember = () => {
  localStorage.setItem("rememberedUser", JSON.stringify(member));
};

type SessionResponse = typeof signedInSession | null;

/**
 * The auth client resolves its session over the network (`customFetchImpl`
 * looks `fetch` up per call), so these tests answer the session check like any
 * other API call rather than mocking the client module.
 */
const answerSessionCheck = (body: SessionResponse) => {
  server.use(http.get("/api/auth/get-session", () => HttpResponse.json(body)));
};

const leaveSessionCheckPending = () => {
  server.use(http.get("/api/auth/get-session", () => delay("infinite")));
};

/**
 * A real pinia, not createTestingPinia: these tests are about the store's own
 * actions and computeds, and testing pinia stubs actions out. The store is
 * instantiated inside a component so the queries it builds run in a normal
 * setup context; `useAuthStore(pinia)` then hands back that same instance.
 */
const mountAuthStore = (queryClient?: QueryClient) => {
  const pinia = createPinia();
  render(PiniaStoreHelper, {
    global: {
      plugins: [
        pinia,
        // Disable query retries so error paths surface immediately instead of
        // racing the default 3x exponential backoff.
        [
          VueQueryPlugin,
          queryClient
            ? { queryClient }
            : { queryClientConfig: { defaultOptions: { queries: { retry: false } } } },
        ],
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

describe("the remembered member", () => {
  it("records who the session resolved to, for the next cold load", async () => {
    const store = await mountWithResolvedSession(signedInSession);

    expect(store.isLoggedIn).toBe(true);
    expect(localStorage.getItem("rememberedUser")).toBe(JSON.stringify(member));
  });

  it("forgets them when the session resolves signed out", async () => {
    rememberMember();

    const store = await mountWithResolvedSession(null);

    expect(store.isLoggedIn).toBe(false);
    expect(localStorage.getItem("rememberedUser")).toBeNull();
  });

  it("still remembers them when the session check itself fails", async () => {
    const store = await mountWithResolvedSession(null);
    rememberMember();
    server.use(http.get("/api/auth/get-session", () => new HttpResponse(null, { status: 500 })));

    await store.refreshSession();
    await nextTick();

    expect(store.isLoggedIn).toBe(false);
    expect(localStorage.getItem("rememberedUser")).toBe(JSON.stringify(member));
  });

  it("predicts nothing for a cold load whose last session was signed out", async () => {
    // The reported bug: with nobody remembered, a still-resolving session must
    // not put a club home on screen — the visitor may well be headed for the
    // landing page. The router still waits (isAppLoading), it just waits on a
    // blank.
    const store = await mountWithPendingSession();

    expect(store.isAppLoading).toBe(true);
    expect(store.isLoadingClubHome).toBe(false);
  });
});

describe("refreshSession", () => {
  it("shows the avatar the member just saved rather than the cached one", async () => {
    // The session endpoint behaves like BetterAuth's: the signed cookie cache
    // answers, still carrying the old avatar, until a caller asks for it to be
    // bypassed and the database — where the upload landed — answers instead.
    const cached = { session: { id: "s-1" }, user: { id: "u-1", image: "https://img/old.png" } };
    const saved = { session: { id: "s-1" }, user: { id: "u-1", image: "https://img/new.png" } };
    server.use(
      http.get("/api/auth/get-session", ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("disableCookieCache") === "true" ? saved : cached,
        ),
      ),
    );

    const store = mountAuthStore();
    await vi.waitFor(() => expect(store.user?.image).toBe("https://img/old.png"));

    await store.refreshSession();

    expect(store.user?.image).toBe("https://img/new.png");
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
    await vi.waitFor(() => {
      expect(router().push).toHaveBeenCalledOnce();
    });
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
    router().push.mockRejectedValueOnce(new Error("guard rejected"));

    const store = await mountWithResolvedSession(signedInSession);
    await store.navigateAfterAuth();

    expect(store.isNavigatingAfterAuth).toBe(false);
  });
});

describe("a cold load whose last session was signed in", () => {
  /**
   * A store created the way a page load creates it: remembering `member`, and
   * with the session check already out when the store first looks. The session
   * atom is shared across tests, so an earlier store puts it back to checking
   * (from signed out, which makes it a first check rather than a refetch).
   */
  const mountAsRememberedMember = async (queryClient?: QueryClient) => {
    const earlier = await mountWithResolvedSession(null);
    leaveSessionCheckPending();
    void earlier.refreshSession();
    await nextTick();
    rememberMember();
    return mountAuthStore(queryClient);
  };

  beforeEach(() => {
    server.use(
      http.get("/api/member/clubs", () =>
        HttpResponse.json([{ clubId: "1", clubName: "Film", slug: "film", type: "movie" }]),
      ),
    );
  });

  // The session atom outlives each test; leave it signed in for the next one.
  afterEach(async () => {
    window.history.replaceState({}, "", "/");
    answerSessionCheck(signedInSession);
    await mountAuthStore().refreshSession();
  });

  it("predicts a club home while that member's clubs are still loading", async () => {
    server.use(http.get("/api/member/clubs", () => delay("infinite")));

    const store = await mountAsRememberedMember();

    expect(store.isAppLoading).toBe(true);
    expect(store.isLoadingClubHome).toBe(true);
  });

  it("carries on as that member while the session check is still out", async () => {
    const store = await mountAsRememberedMember();

    expect(store.session.isPending).toBe(true);
    expect(store.isLoggedIn).toBe(true);
    expect(store.user?.name).toBe("Ada");
    await expect(store.waitForAuthReady()).resolves.toBeUndefined();
  });

  it("opens the app as soon as the member's clubs are in hand", async () => {
    const store = await mountAsRememberedMember();

    await waitFor(() => {
      expect(store.userClubs?.map((club) => club.slug)).toStrictEqual(["film"]);
    });
    expect(store.session.isPending).toBe(true);
    expect(store.isAppLoading).toBe(false);
  });

  it("hands over to the real session once it confirms them", async () => {
    const store = await mountAsRememberedMember();

    answerSessionCheck({ session: { id: "s-1" }, user: { ...member, name: "Ada Lovelace" } });
    await store.refreshSession();

    expect(store.isLoggedIn).toBe(true);
    expect(store.user?.name).toBe("Ada Lovelace");
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it("sends them off a club page when the session turns out to have expired", async () => {
    window.history.replaceState({}, "", "/club/film/reviews");
    const route = useRoute();
    route.meta = { authRequired: true };
    route.params = { clubSlug: "film" };
    route.fullPath = "/club/film/reviews";
    const store = await mountAsRememberedMember();

    answerSessionCheck(null);
    await store.refreshSession();

    expect(store.isLoggedIn).toBe(false);
    await waitFor(() => {
      expect(useRouter().replace).toHaveBeenCalledWith({
        name: "ClubNotFound",
        query: { redirect: "/club/film/reviews" },
      });
    });
  });

  it("sends a visit that began at the site root to the landing page instead", async () => {
    const route = useRoute();
    route.meta = { authRequired: true };
    route.params = { clubSlug: "film" };
    route.fullPath = "/club/film/reviews";
    const store = await mountAsRememberedMember();

    answerSessionCheck(null);
    await store.refreshSession();

    await waitFor(() => {
      expect(useRouter().replace).toHaveBeenCalledWith({ name: "Clubs" });
    });
  });

  it("leaves a visitor where they are on a page that needs no session", async () => {
    const store = await mountAsRememberedMember();

    answerSessionCheck(null);
    await store.refreshSession();
    await nextTick();

    expect(store.isLoggedIn).toBe(false);
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it("drops what the cache held for them when the session has expired", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["list", "film", "reviews"], [{ id: "1", title: "Alien" }]);
    const store = await mountAsRememberedMember(queryClient);

    answerSessionCheck(null);
    await store.refreshSession();

    await waitFor(() => {
      expect(queryClient.getQueryData(["list", "film", "reviews"])).toBeUndefined();
    });
  });

  it("does not assume the same member again once the first check has settled", async () => {
    const store = await mountAsRememberedMember();
    answerSessionCheck(null);
    await store.refreshSession();

    leaveSessionCheckPending();
    void store.refreshSession();
    await nextTick();

    expect(store.session.isPending).toBe(true);
    expect(store.isLoggedIn).toBe(false);
  });

  it("leaves the clubs loading, not failed, once the session turns out to have expired", async () => {
    server.use(http.get("/api/member/clubs", () => new HttpResponse(null, { status: 401 })));
    const store = await mountAsRememberedMember();

    answerSessionCheck(null);
    await store.refreshSession();

    await waitFor(() => {
      expect(store.isLoadingUserClubs).toBe(true);
    });
    expect(store.userClubs).toBeUndefined();
  });
});

describe("waitForAuthReady", () => {
  it("does not hold a signed-in member up while the session refetches", async () => {
    server.use(http.get("/api/member/clubs", () => HttpResponse.json([])));
    const store = await mountWithResolvedSession(signedInSession);
    leaveSessionCheckPending();

    void store.session.refetch();
    await nextTick();

    await expect(store.waitForAuthReady()).resolves.toBeUndefined();
    expect(store.isLoggedIn).toBe(true);

    // The session atom outlives the test; settle it for the next one.
    answerSessionCheck(signedInSession);
    await store.refreshSession();
  });
});
