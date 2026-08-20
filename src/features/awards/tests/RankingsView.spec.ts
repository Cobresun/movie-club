import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import RankingsView from "../views/RankingsView.vue";
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

  it("submits the ranking in the current order", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/club/:id/awards/:year/ranking", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(RankingsView, { props });
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => {
      // The voter is keyed by stable user id (not name) so a rename cannot
      // orphan the ranking — see #397.
      expect(body).toEqual({
        awardTitle: "Best Picture",
        voter: memberData.id,
        movies: [1, 2],
      });
    });
  });
});
