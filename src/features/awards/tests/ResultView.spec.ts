import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import ResultView from "../views/ResultView.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const movieData: DetailedMovieData = {
  kind: "movie",
  actors: [],
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
};

const clubAward: ClubAwards = {
  year: 2024,
  step: AwardsStep.Presentation,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 1,
          movieTitle: "Inception",
          posterUrl: "https://test.com/i.jpg",
          nominatedBy: ["user"],
          ranking: { user: 1, dev: 1 },
          movieData,
        },
      ],
    },
  ],
};

const props = { clubAward, clubId: "test-club", year: "2024" };

describe("ResultView", () => {
  it("renders each award with a Reveal button during presentation", async () => {
    render(ResultView, { props });

    expect(
      await screen.findByRole("heading", { name: "Awards" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
  });

  it("advances the step to Completed once every award is revealed", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/club/:id/awards/:year/step", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(ResultView, { props });

    await user.click(await screen.findByRole("button", { name: "Reveal" }));

    await waitFor(() => {
      expect(body).toMatchObject({ step: AwardsStep.Completed });
    });
  });
});
