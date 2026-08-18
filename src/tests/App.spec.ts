import { screen } from "@testing-library/vue";

import App from "@/App.vue";
import { render } from "@/tests/utils";

// Plain object, mutated per test: each render reads it fresh, so the gate can
// be exercised without needing reactivity in the stub.
const { authStore } = vi.hoisted(() => ({
  authStore: {
    isInitialLoading: false,
    isLoggedIn: false,
    isLoadingUserClubs: false,
    isNavigatingAfterAuth: false,
    showAuthModal: false,
    closeAuthModal: vi.fn(),
  },
}));

vi.mock("@/stores/auth", () => ({ useAuthStore: () => authStore }));

const renderApp = () => render(App, { global: { stubs: { NavBar: true, AuthModal: true } } });

describe("App loading gate", () => {
  beforeEach(() => {
    authStore.isInitialLoading = false;
    authStore.isLoggedIn = false;
    authStore.isLoadingUserClubs = false;
    authStore.isNavigatingAfterAuth = false;
  });

  it("renders the routed page once nothing is loading", () => {
    const { container } = renderApp();

    expect(container.querySelector("router-view-stub")).not.toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the boot placeholder while the session is resolving", () => {
    authStore.isInitialLoading = true;

    const { container } = renderApp();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("router-view-stub")).toBeNull();
  });

  it("holds the placeholder through a post-login navigation", () => {
    // Session and clubs have both resolved; only the hop to the destination is
    // outstanding. Dropping the gate here is what used to flash the page the
    // user signed in from.
    authStore.isLoggedIn = true;
    authStore.isNavigatingAfterAuth = true;

    const { container } = renderApp();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("router-view-stub")).toBeNull();
  });
});
