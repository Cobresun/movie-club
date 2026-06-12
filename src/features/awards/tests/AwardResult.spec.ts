import { screen } from "@testing-library/vue";

import { Award, AwardsStep } from "../../../../lib/types/awards";
import { DetailedMovieData } from "../../../../lib/types/movie";
import AwardResult from "../components/AwardResult.vue";

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

const movieData: DetailedMovieData = {
  kind: "movie",
  actors: [],
  directors: [],
  genres: [],
  production_companies: [],
  production_countries: [],
};

const award: Award = {
  title: "Best Picture",
  nominations: [
    {
      movieId: 1,
      movieTitle: "Inception",
      posterUrl: "https://test.com/inception.jpg",
      nominatedBy: ["dev"],
      ranking: { dev: 1, user: 2 },
      movieData,
    },
    {
      movieId: 2,
      movieTitle: "The Dark Knight",
      posterUrl: "https://test.com/dark-knight.jpg",
      nominatedBy: ["user"],
      ranking: { dev: 2, user: 1 },
      movieData,
    },
  ],
};

describe("AwardResult", () => {
  it("renders the award title", () => {
    render(AwardResult, {
      props: { award, members, step: AwardsStep.Presentation },
    });

    expect(
      screen.getByRole("heading", { name: "Best Picture" }),
    ).toBeInTheDocument();
  });

  it("shows the Reveal button when step is Presentation (not completed)", () => {
    render(AwardResult, {
      props: { award, members, step: AwardsStep.Presentation },
    });

    expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
  });

  it("hides nominations until Reveal is clicked", () => {
    render(AwardResult, {
      props: { award, members, step: AwardsStep.Presentation },
    });

    expect(screen.queryByText("Inception")).not.toBeInTheDocument();
    expect(screen.queryByText("The Dark Knight")).not.toBeInTheDocument();
  });

  it("reveals nominations after clicking Reveal", async () => {
    const { user } = render(AwardResult, {
      props: { award, members, step: AwardsStep.Presentation },
    });

    await user.click(screen.getByRole("button", { name: "Reveal" }));

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("The Dark Knight")).toBeInTheDocument();
  });

  it("emits 'reveal' event when Reveal is clicked", async () => {
    const { user, emitted } = render(AwardResult, {
      props: { award, members, step: AwardsStep.Presentation },
    });

    await user.click(screen.getByRole("button", { name: "Reveal" }));

    expect(emitted().reveal).toHaveLength(1);
  });

  it("shows nominations immediately when step is Completed", () => {
    render(AwardResult, {
      props: { award, members, step: AwardsStep.Completed },
    });

    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("The Dark Knight")).toBeInTheDocument();
  });

  it("does not show the Reveal button when step is Completed", () => {
    render(AwardResult, {
      props: { award, members, step: AwardsStep.Completed },
    });

    expect(
      screen.queryByRole("button", { name: "Reveal" }),
    ).not.toBeInTheDocument();
  });
});
