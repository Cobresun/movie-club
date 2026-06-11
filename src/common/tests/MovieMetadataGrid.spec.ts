import { screen } from "@testing-library/vue";

import MovieMetadataGrid from "../components/MovieMetadataGrid.vue";

import { render } from "@/tests/utils";

describe("MovieMetadataGrid", () => {
  it("renders nothing when no props are provided", () => {
    const { container } = render(MovieMetadataGrid, { props: {} });

    expect(container.textContent?.trim()).toBe("");
  });

  it("renders formatted release date", () => {
    render(MovieMetadataGrid, { props: { releaseDate: "1994-09-23" } });

    expect(screen.getByText("Release Date:")).toBeInTheDocument();
    // The formatted date is locale-dependent; check the label is present
    expect(screen.getByText(/sep/i)).toBeInTheDocument();
  });

  it("renders runtime", () => {
    render(MovieMetadataGrid, { props: { runtime: 142 } });

    expect(screen.getByText("Runtime:")).toBeInTheDocument();
    expect(screen.getByText("142 minutes")).toBeInTheDocument();
  });

  it("renders genres joined by commas", () => {
    render(MovieMetadataGrid, { props: { genres: ["Drama", "Thriller"] } });

    expect(screen.getByText("Genres:")).toBeInTheDocument();
    expect(screen.getByText("Drama, Thriller")).toBeInTheDocument();
  });

  it("renders director names", () => {
    render(MovieMetadataGrid, {
      props: { directors: [{ name: "Christopher Nolan" }] },
    });

    expect(screen.getByText("Director:")).toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
  });

  it("renders TMDB vote average", () => {
    render(MovieMetadataGrid, { props: { voteAverage: 8.3 } });

    expect(screen.getByText("TMDB Rating:")).toBeInTheDocument();
    expect(screen.getByText("8.3/10")).toBeInTheDocument();
  });

  it("does not show genres section when genres is empty", () => {
    render(MovieMetadataGrid, { props: { genres: [] } });

    expect(screen.queryByText("Genres:")).not.toBeInTheDocument();
  });
});
