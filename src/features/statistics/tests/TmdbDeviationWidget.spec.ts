import { screen } from "@testing-library/vue";

import TmdbDeviationWidget from "../components/TmdbDeviationWidget.vue";
import { makeExternalMovie, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const rated = (id: string, title: string, clubScore: number, tmdbScore: number) =>
  makeMovie({
    id,
    title,
    average: clubScore,
    externalData: makeExternalMovie({ vote_average: tmdbScore }),
  });

const movieData = [rated("1", "Underrated Gem", 9, 6), rated("2", "Overrated Blockbuster", 4, 8)];

describe("TmdbDeviationWidget", () => {
  it("opens on the movies the club rated above TMDB", () => {
    render(TmdbDeviationWidget, { props: { movieData } });

    expect(screen.getByRole("heading", { name: "Club vs TMDB" })).toBeInTheDocument();
    expect(screen.getByText("Movies your club rated above the TMDB average")).toBeInTheDocument();
    expect(screen.getByText("Underrated Gem")).toBeInTheDocument();
    expect(screen.queryByText("Overrated Blockbuster")).not.toBeInTheDocument();
  });

  it("shows both scores and a signed deviation", () => {
    render(TmdbDeviationWidget, { props: { movieData } });

    expect(screen.getByText("Club: 9")).toBeInTheDocument();
    expect(screen.getByText("TMDB: 6")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("switches to the movies the club rated below TMDB", async () => {
    const { user } = render(TmdbDeviationWidget, { props: { movieData } });

    await user.click(screen.getByRole("tab", { name: "We Liked Less" }));

    expect(screen.getByText("Movies your club rated below the TMDB average")).toBeInTheDocument();
    expect(screen.getByText("Overrated Blockbuster")).toBeInTheDocument();
    expect(screen.getByText("-4")).toBeInTheDocument();
    expect(screen.queryByText("Underrated Gem")).not.toBeInTheDocument();
  });

  it("offers only the tab that has movies", () => {
    render(TmdbDeviationWidget, { props: { movieData: [rated("1", "Underrated Gem", 9, 6)] } });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "We Liked More",
    ]);
  });

  it("falls back to the only populated tab when the club never rated anything higher", () => {
    render(TmdbDeviationWidget, { props: { movieData: [rated("2", "Overrated", 4, 8)] } });

    expect(screen.getByRole("tab", { name: "We Liked Less" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Overrated")).toBeInTheDocument();
  });

  it("ignores movies TMDB has not rated", () => {
    render(TmdbDeviationWidget, {
      props: { movieData: [rated("1", "Unrated By TMDB", 9, 0)] },
    });

    expect(screen.queryByText("Club vs TMDB")).not.toBeInTheDocument();
  });

  it("renders nothing when club and TMDB agree exactly", () => {
    render(TmdbDeviationWidget, { props: { movieData: [rated("1", "Dead On", 7, 7)] } });

    expect(screen.queryByText("Club vs TMDB")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no movies", () => {
    render(TmdbDeviationWidget, { props: { movieData: [] } });

    expect(screen.queryByText("Club vs TMDB")).not.toBeInTheDocument();
  });
});
