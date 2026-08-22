import { screen } from "@testing-library/vue";

import App from "@/App.vue";
import { render } from "@/tests/utils";

// Plain object, mutated per test: each render reads it fresh, so the gate can
// be exercised without needing reactivity in the stub.
const { authStore } = vi.hoisted(() => ({
  authStore: {
    isAppLoading: false,
    isLoadingClubHome: false,
    showAuthModal: false,
    closeAuthModal: vi.fn(),
  },
}));

vi.mock("@/stores/auth", () => ({ useAuthStore: () => authStore }));

const renderApp = () => render(App, { global: { stubs: { NavBar: true, AuthModal: true } } });

describe("App loading gate", () => {
  beforeEach(() => {
    authStore.isAppLoading = false;
    authStore.isLoadingClubHome = false;
  });

  it("renders the routed page once nothing is loading", () => {
    const { container } = renderApp();

    expect(container.querySelector("router-view-stub")).not.toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the placeholder when a club home is what's loading", () => {
    authStore.isAppLoading = true;
    authStore.isLoadingClubHome = true;

    const { container } = renderApp();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(container.querySelector("router-view-stub")).toBeNull();
  });

  it("paints nothing while a load that isn't a club home is pending", () => {
    // The reported bug: refreshing while logged out flashed a club home on the
    // way to the landing page. The gate still holds the router back — routes
    // without a guard branch on isLoggedIn and would paint their logged-out
    // half mid-check — it just holds a blank frame instead of a wrong page.
    authStore.isAppLoading = true;

    const { container } = renderApp();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector("router-view-stub")).toBeNull();
  });
});
