import { screen } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import StatsWidget from "../components/StatsWidget.vue";
import { makeBook, makeExternalBook, makeExternalMovie, makeMovie } from "./fixtures";
import { render } from "@/tests/utils";

const movies = (...runtimes: number[]) =>
  runtimes.map((runtime, index) =>
    makeMovie({ id: String(index), externalData: makeExternalMovie({ runtime }) }),
  );

describe("StatsWidget", () => {
  it("counts the works with the movie club's label and icon", () => {
    render(StatsWidget, { props: { workData: movies(90, 120), clubType: ClubType.movie } });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("movies watched")).toBeInTheDocument();
  });

  it("counts the works with the book club's label", () => {
    render(StatsWidget, {
      props: { workData: [makeBook({ id: "a" }), makeBook({ id: "b" })], clubType: ClubType.book },
    });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("books read")).toBeInTheDocument();
  });

  it("sums runtimes into hours and minutes for a movie club", () => {
    render(StatsWidget, { props: { workData: movies(90, 45), clubType: ClubType.movie } });

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });

  it("omits the day count until the club passes 24 hours of watch time", () => {
    render(StatsWidget, { props: { workData: movies(120), clubType: ClubType.movie } });

    expect(screen.getByText("watch time")).toBeInTheDocument();
    expect(screen.queryByText(/day/)).not.toBeInTheDocument();
  });

  it("adds a rounded day count once watch time exceeds 24 hours", () => {
    // 30 × 120 min = 60h → 3 days (rounded from 2.5).
    render(StatsWidget, {
      props: { workData: movies(...Array<number>(30).fill(120)), clubType: ClubType.movie },
    });

    expect(screen.getByText("60h 0m")).toBeInTheDocument();
    expect(screen.getByText(/\(3 days\)/)).toBeInTheDocument();
  });

  it("singularizes a one-day watch time", () => {
    // 13 × 120 min = 26h → "1 day", the boundary just past 24 hours.
    render(StatsWidget, {
      props: { workData: movies(...Array<number>(13).fill(120)), clubType: ClubType.movie },
    });

    expect(screen.getByText(/\(1 day\)/)).toBeInTheDocument();
  });

  it("treats a movie with no runtime as zero rather than NaN", () => {
    render(StatsWidget, {
      props: {
        workData: [
          makeMovie({ id: "1", externalData: makeExternalMovie({ runtime: undefined }) }),
          makeMovie({ id: "2", externalData: makeExternalMovie({ runtime: 100 }) }),
        ],
        clubType: ClubType.movie,
      },
    });

    expect(screen.getByText("1h 40m")).toBeInTheDocument();
  });

  it("shows no watch-time tile for a book club", () => {
    render(StatsWidget, { props: { workData: [makeBook()], clubType: ClubType.book } });

    expect(screen.queryByText("watch time")).not.toBeInTheDocument();
  });

  it("sums page counts for a book club, with thousands separators", () => {
    render(StatsWidget, {
      props: {
        workData: [
          makeBook({ id: "1", externalData: makeExternalBook({ numberOfPages: 800 }) }),
          makeBook({ id: "2", externalData: makeExternalBook({ numberOfPages: 450 }) }),
        ],
        clubType: ClubType.book,
      },
    });

    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("pages read")).toBeInTheDocument();
  });

  it("hides the pages tile when no book carries a page count", () => {
    render(StatsWidget, {
      props: { workData: [makeBook(), makeBook({ id: "b2" })], clubType: ClubType.book },
    });

    expect(screen.queryByText("pages read")).not.toBeInTheDocument();
  });

  it("reports zero works for an empty club", () => {
    render(StatsWidget, { props: { workData: [], clubType: ClubType.movie } });

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("0h 0m")).toBeInTheDocument();
  });
});
