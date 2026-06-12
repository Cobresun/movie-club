import { createTestingPinia } from "@pinia/testing";
import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import RankingsView from "../views/RankingsView.vue";

import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
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
  step: AwardsStep.Ratings,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 1,
          movieTitle: "Inception",
          posterUrl: "https://test.com/i.jpg",
          nominatedBy: ["user"],
          ranking: { user: 1, dev: 2 },
          movieData,
        },
        {
          movieId: 2,
          movieTitle: "Tenet",
          posterUrl: "https://test.com/t.jpg",
          nominatedBy: ["dev"],
          ranking: { user: 2, dev: 1 },
          movieData,
        },
      ],
    },
  ],
};

const props = { clubAward, clubId: "test-club", year: "2024" };

function login(pinia: ReturnType<typeof createTestingPinia>) {
  const authStore = useAuthStore(pinia);
  // @ts-expect-error Overwriting readonly session user for testing purposes
  authStore.user = {
    id: memberData.id,
    email: memberData.email,
    name: memberData.name,
    image: memberData.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  };
}

describe("RankingsView", () => {
  it("prompts the user to log in when not authenticated", () => {
    render(RankingsView, { props });

    expect(
      screen.getByText("Please log in to rank movies!"),
    ).toBeInTheDocument();
  });

  it("renders a ranking widget per award when logged in", async () => {
    const { pinia } = render(RankingsView, { props });
    login(pinia);

    expect(
      await screen.findByRole("heading", { name: "Best Picture" }),
    ).toBeInTheDocument();
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
    login(pinia);

    await user.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(body).toMatchObject({
        awardTitle: "Best Picture",
        voter: "user",
        movies: [1, 2],
      });
    });
  });
});
