import { screen } from "@testing-library/vue";

import MovieMetadataGrid from "../components/MovieMetadataGrid.vue";
import { render } from "@/tests/utils";

describe("MovieMetadataGrid", () => {
  it("renders nothing when no props are provided", () => {
    const { container } = render(MovieMetadataGrid, { props: {} });

    expect(container.textContent?.trim()).toBe("");
  });

  it("renders the release date in a readable format", () => {
    render(MovieMetadataGrid, { props: { releaseDate: "1994-09-23" } });

    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("Sep 22, 1994")).toBeInTheDocument();
  });

  it("renders runtime as hours and minutes", () => {
    render(MovieMetadataGrid, { props: { runtime: 142 } });

    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText("2h 22m")).toBeInTheDocument();
  });

  it("drops the hour part for a runtime under an hour", () => {
    render(MovieMetadataGrid, { props: { runtime: 47 } });

    expect(screen.getByText("47m")).toBeInTheDocument();
  });

  it("renders each genre as its own chip", () => {
    render(MovieMetadataGrid, { props: { genres: ["Drama", "Thriller"] } });

    expect(screen.getByText("Genres")).toBeInTheDocument();
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Thriller")).toBeInTheDocument();
  });

  it("labels a single director in the singular", () => {
    render(MovieMetadataGrid, {
      props: { directors: [{ name: "Christopher Nolan" }] },
    });

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
  });

  it("labels co-directors in the plural and joins their names", () => {
    render(MovieMetadataGrid, {
      props: { directors: [{ name: "Joel Coen" }, { name: "Ethan Coen" }] },
    });

    expect(screen.getByText("Directors")).toBeInTheDocument();
    expect(screen.getByText("Joel Coen, Ethan Coen")).toBeInTheDocument();
  });

  it("rounds the TMDB rating to one decimal place", () => {
    render(MovieMetadataGrid, { props: { voteAverage: 8.267 } });

    expect(screen.getByText("TMDB rating")).toBeInTheDocument();
    expect(screen.getByText(/8\.3/)).toBeInTheDocument();
    expect(screen.getByText("/10")).toBeInTheDocument();
  });

  it("does not show genres section when genres is empty", () => {
    render(MovieMetadataGrid, { props: { genres: [] } });

    expect(screen.queryByText("Genres")).not.toBeInTheDocument();
  });
});
