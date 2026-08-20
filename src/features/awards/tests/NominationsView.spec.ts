import { screen } from "@testing-library/vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import NominationsView from "../views/NominationsView.vue";
import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
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
  step: AwardsStep.Nominations,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 1,
          movieTitle: "Inception",
          posterUrl: "https://test.com/i.jpg",
          nominatedBy: [memberData.id],
          ranking: {},
          movieData,
        },
        {
          movieId: 2,
          movieTitle: "Tenet",
          posterUrl: "https://test.com/t.jpg",
          nominatedBy: ["999"],
          ranking: {},
          movieData,
        },
      ],
    },
  ],
};

const props = { clubAward, clubSlug: "test-club", year: "2024" };

describe("NominationsView", () => {
  it("shows only the current user's own nominations", async () => {
    const { pinia } = render(NominationsView, { props });
    logIn(pinia);

    expect(await screen.findByRole("heading", { name: "Best Picture" })).toBeInTheDocument();
    // Nominations are attributed by user id: I nominated Inception, another
    // member nominated Tenet — only mine shows.
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.queryByText("Tenet")).not.toBeInTheDocument();
  });

  it("reports nomination progress across categories", async () => {
    const { pinia } = render(NominationsView, { props });
    logIn(pinia);

    expect(await screen.findByText("1 / 1 categories")).toBeInTheDocument();
  });

  it("shows no categories and zero progress when logged out", () => {
    render(NominationsView, { props });

    expect(screen.getByText("0 / 1 categories")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Best Picture" })).not.toBeInTheDocument();
  });
});
