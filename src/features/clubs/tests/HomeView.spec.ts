import { screen } from "@testing-library/vue";

import HomeView from "../views/HomeView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

// The example club's posters go through v-lazy-load.
mockIntersectionObserver();

describe("HomeView", () => {
  it("renders the main heading", () => {
    render(HomeView);

    expect(screen.getByText(/Get your 🍿 ready for MovieClub/i)).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(HomeView);

    expect(
      screen.getByText(/Rate movies, compare favorites, and find patterns/i),
    ).toBeInTheDocument();
  });

  it("shows an example club's scores before anyone signs up", () => {
    render(HomeView);

    expect(screen.getByRole("img", { name: /example club's reviews/i })).toBeInTheDocument();
  });

  it("sends a new visitor to sign up rather than sign in", async () => {
    const { user } = render(HomeView);

    await user.click(screen.getByRole("button", { name: /Get started/ }));

    const authStore = useAuthStore();
    expect(authStore.signUp).toHaveBeenCalled();
    expect(authStore.login).not.toHaveBeenCalled();
  });
});
