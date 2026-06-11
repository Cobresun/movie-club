import { screen } from "@testing-library/vue";

import HomeView from "../views/HomeView.vue";

import { render } from "@/tests/utils";

describe("HomeView", () => {
  it("renders the main heading", () => {
    render(HomeView);

    expect(
      screen.getByText(/Get your 🍿 ready for MovieClub/i),
    ).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(HomeView);

    expect(
      screen.getByText(/Rate movies, compare favorites, and find patterns/i),
    ).toBeInTheDocument();
  });
});
