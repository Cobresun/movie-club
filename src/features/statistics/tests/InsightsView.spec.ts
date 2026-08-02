import { screen } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import InsightsView from "../views/InsightsView.vue";
import {
  makeExternalBook,
  makeExternalMovie,
  makeHistogram,
  makeMember,
  makeMovie,
  makeBook,
} from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

mockIntersectionObserver();

const members = [
  makeMember({ id: "m1", name: "Ada" }),
  makeMember({ id: "m2", name: "Alan" }),
  makeMember({ id: "m3", name: "Grace" }),
];

const histogramData = makeHistogram(["m1", "m2", "m3"]);

const movieData = [
  makeMovie({
    id: "1",
    title: "Dune",
    average: 8,
    genres: ["Sci-Fi"],
    userScores: { m1: 9, m2: 8, m3: 7 },
    externalData: makeExternalMovie({ vote_average: 6, release_date: "2021-10-22" }),
  }),
  makeMovie({
    id: "2",
    title: "Arrival",
    average: 7,
    genres: ["Sci-Fi"],
    userScores: { m1: 8, m2: 7, m3: 6 },
    externalData: makeExternalMovie({ vote_average: 8, release_date: "2016-11-11" }),
  }),
];

const bookData = [
  makeBook({
    id: "b1",
    title: "Dune",
    average: 9,
    userScores: { m1: 9, m2: 9, m3: 9 },
    externalData: makeExternalBook({ authors: ["Frank Herbert"], subjects: ["Science Fiction"] }),
  }),
  makeBook({
    id: "b2",
    title: "Kindred",
    average: 7,
    userScores: { m1: 7, m2: 7, m3: 7 },
    externalData: makeExternalBook({ authors: ["Octavia Butler"], subjects: ["Science Fiction"] }),
  }),
];

describe("InsightsView", () => {
  it("renders the movie club's widget set", () => {
    render(InsightsView, {
      props: { workData: movieData, members, histogramData, clubType: ClubType.movie },
    });

    expect(screen.getByText("movies watched")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Club Records" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Club Activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Genres" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Through the Years" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reviewer Stats" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Club Consensus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Club vs TMDB" })).toBeInTheDocument();
  });

  it("omits the book-only widgets from a movie club", () => {
    render(InsightsView, {
      props: { workData: movieData, members, histogramData, clubType: ClubType.movie },
    });

    expect(screen.queryByText("Subjects")).not.toBeInTheDocument();
    expect(screen.queryByText("Most Read Authors")).not.toBeInTheDocument();
    expect(screen.queryByText("books read")).not.toBeInTheDocument();
  });

  it("renders the book club's widget set", () => {
    render(InsightsView, {
      props: { workData: bookData, members, histogramData, clubType: ClubType.book },
    });

    expect(screen.getByText("books read")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Subjects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Most Read Authors" })).toBeInTheDocument();
  });

  it("omits the movie-only widgets from a book club", () => {
    render(InsightsView, {
      props: { workData: bookData, members, histogramData, clubType: ClubType.book },
    });

    expect(screen.queryByText("Genres")).not.toBeInTheDocument();
    expect(screen.queryByText("Filmmakers")).not.toBeInTheDocument();
    expect(screen.queryByText("Club vs TMDB")).not.toBeInTheDocument();
  });

  it("hides the comparison widgets in a one-member club", () => {
    render(InsightsView, {
      props: {
        workData: movieData,
        members: [members[0]],
        histogramData,
        clubType: ClubType.movie,
      },
    });

    expect(screen.queryByText("Reviewer Stats")).not.toBeInTheDocument();
    expect(screen.queryByText("Guilty Pleasures")).not.toBeInTheDocument();
    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
    // Widgets that work for any club size still render.
    expect(screen.getByRole("heading", { name: "Club Records" })).toBeInTheDocument();
  });

  it("shows the reviewer leaderboard but no similarity widget in a two-member club", () => {
    render(InsightsView, {
      props: {
        workData: movieData,
        members: members.slice(0, 2),
        histogramData,
        clubType: ClubType.movie,
      },
    });

    expect(screen.getByRole("heading", { name: "Reviewer Stats" })).toBeInTheDocument();
    expect(screen.queryByText("Taste Similarity")).not.toBeInTheDocument();
  });

  it("renders the always-on widgets even with no reviews", () => {
    render(InsightsView, {
      props: { workData: [], members, histogramData, clubType: ClubType.movie },
    });

    expect(screen.getByText("movies watched")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
    expect(screen.queryByText("Club Records")).not.toBeInTheDocument();
  });
});
