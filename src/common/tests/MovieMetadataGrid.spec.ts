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

  it("shows only first 5 actors by default", () => {
    const actors = [
      { name: "Actor A" },
      { name: "Actor B" },
      { name: "Actor C" },
      { name: "Actor D" },
      { name: "Actor E" },
      { name: "Actor F" },
    ];
    render(MovieMetadataGrid, { props: { actors } });

    expect(screen.getByText(/Actor A/)).toBeInTheDocument();
    expect(screen.getByText(/Actor E/)).toBeInTheDocument();
    // Actor F is hidden behind "more" button
    expect(screen.queryByText(/Actor F/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+1 more/i }),
    ).toBeInTheDocument();
  });

  it("shows all actors after clicking 'more' button", async () => {
    const actors = [
      { name: "Actor A" },
      { name: "Actor B" },
      { name: "Actor C" },
      { name: "Actor D" },
      { name: "Actor E" },
      { name: "Actor F" },
    ];
    const { user } = render(MovieMetadataGrid, { props: { actors } });

    await user.click(screen.getByRole("button", { name: /\+1 more/i }));

    expect(screen.getByText(/Actor F/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument();
  });

  it("hides extra actors again after clicking 'Show less'", async () => {
    const actors = Array.from({ length: 7 }, (_, i) => ({
      name: `Actor ${i}`,
    }));
    const { user } = render(MovieMetadataGrid, { props: { actors } });

    await user.click(screen.getByRole("button", { name: /\+2 more/i }));
    expect(
      screen.getByRole("button", { name: /show less/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show less/i }));
    expect(
      screen.getByRole("button", { name: /\+2 more/i }),
    ).toBeInTheDocument();
  });

  it("does not show genres section when genres is empty", () => {
    render(MovieMetadataGrid, { props: { genres: [] } });

    expect(screen.queryByText("Genres:")).not.toBeInTheDocument();
  });
});
