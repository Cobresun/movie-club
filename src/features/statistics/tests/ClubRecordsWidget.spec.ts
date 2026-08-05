import { screen } from "@testing-library/vue";

import ClubRecordsWidget from "../components/ClubRecordsWidget.vue";
import { makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const workData = [
  makeMovie({
    id: "1",
    title: "Paddington 2",
    average: 9.4,
    imageUrl: "https://image.tmdb.org/paddington.jpg",
    userScores: { a: 9, b: 9.8 },
  }),
  makeMovie({ id: "2", title: "Middling Movie", average: 6, userScores: { a: 6, b: 6 } }),
  makeMovie({ id: "3", title: "The Room", average: 3, userScores: { a: 1, b: 5 } }),
];

describe("ClubRecordsWidget", () => {
  it("names the highest and lowest rated works with their averages", () => {
    render(ClubRecordsWidget, { props: { workData } });

    expect(screen.getByText("Highest Rated")).toBeInTheDocument();
    expect(screen.getByText("Paddington 2")).toBeInTheDocument();
    expect(screen.getByText("9.4")).toBeInTheDocument();

    expect(screen.getByText("Lowest Rated")).toBeInTheDocument();
    // The Room is both the lowest rated and the most divisive here.
    expect(screen.getAllByText("The Room")).toHaveLength(2);
    expect(screen.getByText("3.0")).toBeInTheDocument();
  });

  it("names the widest score spread as the most divisive work", () => {
    render(ClubRecordsWidget, { props: { workData } });

    expect(screen.getByText("Most Divisive")).toBeInTheDocument();
    // The Room's 1 vs 5 is a std dev of 2, the widest of the three.
    expect(screen.getByText("±2.0 spread")).toBeInTheDocument();
  });

  it("renders the poster when a record has an image", () => {
    render(ClubRecordsWidget, { props: { workData } });

    expect(screen.getByRole("img", { name: "Paddington 2" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/paddington.jpg",
    );
  });

  it("falls back to a placeholder for a record with no poster", () => {
    render(ClubRecordsWidget, { props: { workData } });

    expect(screen.queryByRole("img", { name: "The Room" })).not.toBeInTheDocument();
    expect(screen.getAllByText("?").length).toBeGreaterThan(0);
  });

  it("renders nothing until the club has at least two works", () => {
    render(ClubRecordsWidget, { props: { workData: [workData[0]] } });

    expect(screen.queryByText("Club Records")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no works", () => {
    render(ClubRecordsWidget, { props: { workData: [] } });

    expect(screen.queryByText("Club Records")).not.toBeInTheDocument();
  });

  it("shows the high and low tiles but no divisive tile when nobody scored individually", () => {
    render(ClubRecordsWidget, {
      props: {
        workData: [
          makeMovie({ id: "1", title: "Solo Score", average: 8 }),
          makeMovie({ id: "2", title: "Other", average: 4 }),
        ],
      },
    });

    expect(screen.getByText("Highest Rated")).toBeInTheDocument();
    expect(screen.getByText("Lowest Rated")).toBeInTheDocument();
    expect(screen.queryByText("Most Divisive")).not.toBeInTheDocument();
  });
});
