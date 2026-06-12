import { screen } from "@testing-library/vue";

import { DetailedMovieData } from "../../../../lib/types/movie";
import MovieTooltip from "../components/MovieTooltip.vue";

import { render } from "@/tests/utils";

const fullMovie: DetailedMovieData = {
  kind: "movie",
  actors: [],
  directors: [{ name: "Christopher Nolan", profilePath: null }],
  genres: ["Action", "Sci-Fi"],
  production_companies: ["Warner Bros."],
  production_countries: [],
  tagline: "Your mind is the scene of the crime.",
  overview: "A thief who steals corporate secrets through dream-sharing tech.",
  release_date: "2010-07-16",
  runtime: 148,
  vote_average: 8.4,
};

describe("MovieTooltip", () => {
  it("renders the title with no tooltip details when no movie data is given", () => {
    render(MovieTooltip, { props: { title: "Inception" } });

    expect(screen.getByText("Inception")).toBeInTheDocument();
    // Without movie data the hover tooltip (and its heading) is not rendered.
    expect(
      screen.queryByRole("heading", { name: "Inception" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Runtime:/)).not.toBeInTheDocument();
  });

  it("renders the full movie details in the tooltip", () => {
    render(MovieTooltip, { props: { title: "Inception", movie: fullMovie } });

    expect(
      screen.getByRole("heading", { name: "Inception" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your mind is the scene of the crime."),
    ).toBeInTheDocument();
    expect(screen.getByText(/A thief who steals/)).toBeInTheDocument();
    expect(screen.getByText("148 minutes")).toBeInTheDocument();
    expect(screen.getByText("Action, Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("8.4/10")).toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
    expect(screen.getByText("Warner Bros.")).toBeInTheDocument();
  });

  it("omits each detail row that is absent from the movie data", () => {
    const sparse: DetailedMovieData = {
      kind: "movie",
      actors: [],
      directors: [],
      genres: [],
      production_companies: [],
      production_countries: [],
      overview: "Only an overview is known.",
    };

    render(MovieTooltip, { props: { title: "Mystery", movie: sparse } });

    expect(screen.getByText("Only an overview is known.")).toBeInTheDocument();
    expect(screen.queryByText(/Runtime:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Genres:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rating:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Director:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Studios:/)).not.toBeInTheDocument();
  });

  it("rounds the rating to one decimal place", () => {
    render(MovieTooltip, {
      props: {
        title: "Rounded",
        movie: { ...fullMovie, vote_average: 7 },
      },
    });

    expect(screen.getByText("7.0/10")).toBeInTheDocument();
  });
});
