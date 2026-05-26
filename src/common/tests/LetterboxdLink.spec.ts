import { screen } from "@testing-library/vue";

import LetterboxdLink from "../components/LetterboxdLink.vue";

import { render } from "@/tests/utils";

describe("LetterboxdLink", () => {
  it("links to the Letterboxd film page for the given TMDB id", () => {
    render(LetterboxdLink, { props: { tmdbId: "550" } });

    const link = screen.getByRole("link", { name: /letterboxd/i });
    expect(link).toHaveAttribute("href", "https://letterboxd.com/tmdb/550/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders nothing when no TMDB id is provided", () => {
    render(LetterboxdLink, { props: {} });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
