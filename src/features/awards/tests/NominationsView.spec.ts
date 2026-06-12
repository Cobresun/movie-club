import { createTestingPinia } from "@pinia/testing";
import { screen } from "@testing-library/vue";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import NominationsView from "../views/NominationsView.vue";

import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
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
  step: AwardsStep.Nominations,
  awards: [
    {
      title: "Best Picture",
      nominations: [
        {
          movieId: 1,
          movieTitle: "Inception",
          posterUrl: "https://test.com/i.jpg",
          nominatedBy: ["user"],
          ranking: {},
          movieData,
        },
        {
          movieId: 2,
          movieTitle: "Tenet",
          posterUrl: "https://test.com/t.jpg",
          nominatedBy: ["dev"],
          ranking: {},
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

describe("NominationsView", () => {
  it("shows only the current user's own nominations", async () => {
    const { pinia } = render(NominationsView, { props });
    login(pinia);

    expect(
      await screen.findByRole("heading", { name: "Best Picture" }),
    ).toBeInTheDocument();
    // "user" nominated Inception; "dev" nominated Tenet — only mine shows.
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.queryByText("Tenet")).not.toBeInTheDocument();
  });

  it("reports nomination progress across categories", async () => {
    const { pinia } = render(NominationsView, { props });
    login(pinia);

    expect(await screen.findByText("1 / 1 categories")).toBeInTheDocument();
  });

  it("shows no categories and zero progress when logged out", () => {
    render(NominationsView, { props });

    expect(screen.getByText("0 / 1 categories")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Best Picture" }),
    ).not.toBeInTheDocument();
  });
});
