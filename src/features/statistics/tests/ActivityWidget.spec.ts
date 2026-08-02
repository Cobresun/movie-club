import { screen } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import ActivityWidget from "../components/ActivityWidget.vue";
import { makeBook, makeMovie } from "./fixtures";
import { chartSeriesNames } from "@/mocks/agCharts";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

mockIntersectionObserver();

const workData = [
  makeMovie({
    id: "1",
    title: "January Pick",
    createdDate: "2023-01-15T00:00:00.000Z",
    average: 8.5,
    imageUrl: "https://image.tmdb.org/jan.jpg",
  }),
  makeMovie({
    id: "2",
    title: "February Pick",
    createdDate: "2023-02-20T00:00:00.000Z",
    average: 6,
  }),
  makeMovie({
    id: "3",
    title: "Next Year",
    createdDate: "2024-05-01T00:00:00.000Z",
    average: 7.25,
  }),
];

const props = { workData, clubType: ClubType.movie };

describe("ActivityWidget", () => {
  it("opens on the monthly chart", () => {
    render(ActivityWidget, { props });

    expect(screen.getByRole("heading", { name: "Club Activity" })).toBeInTheDocument();
    expect(screen.getByText("Movies reviewed per month")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Monthly" })).toHaveAttribute("aria-selected", "true");
    expect(chartSeriesNames(screen.getByRole("img", { name: "chart" }))).toEqual(["Movies"]);
  });

  it("switches to the all-time cumulative chart", async () => {
    const { user } = render(ActivityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "All Time" }));

    expect(screen.getByText("Total movies reviewed over time")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "chart" })).toBeInTheDocument();
  });

  it("replaces the chart with a per-year list in Best of Year mode", async () => {
    const { user } = render(ActivityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Best of Year" }));

    expect(
      screen.getByText("The top-rated movie from each year your club reviewed"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "chart" })).not.toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("names each year's highest rated work with its average", async () => {
    const { user } = render(ActivityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Best of Year" }));

    expect(screen.getByText("January Pick")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("Next Year")).toBeInTheDocument();
    expect(screen.getByText("7.3")).toBeInTheDocument();
  });

  it("counts how many works each year contributed, singularizing one", async () => {
    const { user } = render(ActivityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Best of Year" }));

    expect(screen.getByText("2 movies reviewed")).toBeInTheDocument();
    expect(screen.getByText("1 movie reviewed")).toBeInTheDocument();
  });

  it("shows a poster when the year's winner has one and a placeholder otherwise", async () => {
    const { user } = render(ActivityWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Best of Year" }));

    expect(screen.getByRole("img", { name: "January Pick" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/jan.jpg",
    );
    expect(screen.queryByRole("img", { name: "Next Year" })).not.toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("uses book-club nouns for a book club", () => {
    render(ActivityWidget, {
      props: {
        workData: [makeBook({ id: "b1", createdDate: "2023-01-15T00:00:00.000Z" })],
        clubType: ClubType.book,
      },
    });

    expect(screen.getByText("Books reviewed per month")).toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(ActivityWidget, { props: { workData: [], clubType: ClubType.movie } });

    expect(screen.queryByText("Club Activity")).not.toBeInTheDocument();
  });
});
