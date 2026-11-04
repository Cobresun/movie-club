import { screen, within } from "@testing-library/vue";

import HomeView from "../views/HomeView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

describe("HomeView", () => {
  beforeEach(() => {
    mockIntersectionObserver();
  });

  it("renders the main heading", () => {
    render(HomeView);

    expect(
      screen.getByRole("heading", { level: 1, name: /The book club for movies/i }),
    ).toBeInTheDocument();
  });

  it("previews a movie club's gallery first", () => {
    render(HomeView);

    const club = screen.getByRole("region", { name: /Thursday Night Film Society/i });
    expect(within(club).getByRole("heading", { name: "Past Lives" })).toBeInTheDocument();
    expect(within(club).getByRole("img", { name: "Dune: Part Two" })).toBeInTheDocument();
  });

  it("switches the preview to a book club", async () => {
    const { user } = render(HomeView);

    await user.click(screen.getByRole("tab", { name: "Books" }));

    expect(screen.getByRole("tab", { name: "Books" })).toHaveAttribute("aria-selected", "true");
    const club = screen.getByRole("region", { name: /Second Chapter Book Club/i });
    expect(within(club).getByRole("heading", { name: "Piranesi" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /Thursday Night Film Society/i }),
    ).not.toBeInTheDocument();
  });

  it("spins the watchlist for a different pick", async () => {
    const { user } = render(HomeView);

    expect(screen.getByText("Aftersun")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Spin again" }));

    expect(screen.getByText("Anatomy of a Fall")).toBeInTheDocument();
    expect(screen.queryByText("Aftersun")).not.toBeInTheDocument();
  });

  it("invites visitors to play the daily game", () => {
    render(HomeView);

    const game = screen.getByRole("region", { name: "Reelated" });
    expect(within(game).getByRole("link", { name: "Play today’s movie" })).toBeInTheDocument();
    expect(within(game).getByRole("listitem", { name: /^Arrival/ })).toBeInTheDocument();
  });
});
