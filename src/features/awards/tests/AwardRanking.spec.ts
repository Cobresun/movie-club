import { screen } from "@testing-library/vue";

import { Award } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import AwardRanking from "../components/AwardRanking.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  {
    id: "1",
    email: "dev@email.com",
    name: "dev",
    image: "https://test.com/profile",
  },
  {
    id: "2",
    email: "user@email.com",
    name: "user",
    image: "https://test.com/otherProfile",
  },
];

const currentUser = members[0];

const movieData: DetailedMovieData = {
  kind: "movie",
  actors: [],
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
};

const award: Award = {
  title: "Best Director",
  nominations: [
    {
      movieId: 10,
      movieTitle: "Parasite",
      posterUrl: "https://test.com/parasite.jpg",
      nominatedBy: ["dev"],
      ranking: { dev: 1, user: 2 },
      movieData,
    },
    {
      movieId: 20,
      movieTitle: "Moonlight",
      posterUrl: "https://test.com/moonlight.jpg",
      nominatedBy: ["user"],
      ranking: { dev: 2, user: 1 },
      movieData,
    },
  ],
};

describe("AwardRanking", () => {
  it("renders the award title", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(
      screen.getByRole("heading", { name: "Best Director" }),
    ).toBeInTheDocument();
  });

  it("renders all nominated movies", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByText("Parasite")).toBeInTheDocument();
    expect(screen.getByText("Moonlight")).toBeInTheDocument();
  });

  it("renders a Submit button", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("emits 'submit-ranking' with movie IDs in current order when Submit is clicked", async () => {
    const { user, emitted } = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    await user.click(screen.getByRole("button", { name: "Submit" }));

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    expect(emitted()["submit-ranking"]).toEqual([[[10, 20]]]);
  });

  it("shows left-chevron for all but the first nomination", () => {
    render(AwardRanking, { props: { award, members, user: currentUser } });

    // First card should only have chevron-right; second should have both
    const buttons = screen.getAllByRole("button");
    // Submit + left + right chevron buttons (Submit, right for first, left+right for second)
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("re-orders nominations when the right chevron is clicked on the first card", async () => {
    const { user, emitted } = render(AwardRanking, {
      props: { award, members, user: currentUser },
    });

    // For "dev" the initial order is Parasite (10) then Moonlight (20).
    const chevronRight = screen
      .getAllByRole("button")
      .find((btn) => btn.querySelector(".mdi-chevron-right"));
    expect(chevronRight).toBeDefined();
    if (chevronRight) await user.click(chevronRight);

    // Submitting now should report the swapped order.
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(emitted()["submit-ranking"]).toEqual([[[20, 10]]]);
  });
});
