import { screen } from "@testing-library/vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import RankingsView from "../views/RankingsView.vue";
import { awardsApi } from "@/mocks/awards";
import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

const movieData: DetailedMovieData = {
  kind: "movie",
  actors: [],
  castNames: [],
  majorCastNames: [],
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
};

const clubAward: ClubAwards = {
  year: 2024,
  step: AwardsStep.Ratings,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 1,
          movieTitle: "Inception",
          posterUrl: "https://test.com/i.jpg",
          nominatedBy: [memberData.id],
          ranking: { "2": 1, "1": 2 },
          movieData,
        },
        {
          movieId: 2,
          movieTitle: "Tenet",
          posterUrl: "https://test.com/t.jpg",
          nominatedBy: ["999"],
          ranking: { "2": 2, "1": 1 },
          movieData,
        },
      ],
    },
  ],
};

const props = { clubAward, clubSlug: "test-club", year: "2024" };

describe("RankingsView", () => {
  it("prompts the user to log in when not authenticated", () => {
    render(RankingsView, { props });

    expect(screen.getByText("Please log in to rank movies!")).toBeInTheDocument();
  });

  it("renders a ranking widget per award when logged in", async () => {
    const { pinia } = render(RankingsView, { props });
    logIn(pinia);

    expect(await screen.findByRole("heading", { name: "Best Picture" })).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("Tenet")).toBeInTheDocument();
  });

  it("tells the member how many categories they have left to rank", async () => {
    const { pinia } = render(RankingsView, { props });
    logIn(pinia);

    expect(await screen.findByText("You've ranked 1 of 1 category.")).toBeInTheDocument();
  });

  it("confirms the ballot once it is saved", async () => {
    server.use(...awardsApi([clubAward]));

    const { user, pinia } = render(RankingsView, { props });
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: "Update ranking" }));

    // The toast plugin is installed twice in tests (see useAddListItem.spec.ts),
    // so the toast shows up in more than one container.
    expect(await screen.findAllByText("Saved your Best Picture ranking")).not.toHaveLength(0);
  });
});
