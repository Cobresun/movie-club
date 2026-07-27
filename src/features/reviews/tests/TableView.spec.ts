import { screen, within } from "@testing-library/vue";

import TableView from "../components/TableView.vue";
import { makeReview, makeReviewMember, score, withReviewTable } from "./reviewTable";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  makeReviewMember({ id: "m1", name: "Ada Lovelace" }),
  makeReviewMember({ id: "m2", name: "Alan Turing" }),
];

const reviews = [
  makeReview({
    id: "1",
    title: "Dune",
    createdDate: "2024-05-28T04:46:37.751Z",
    scores: { m1: score("s1", 9), m2: score("s2", 7), average: score("avg1", 8) },
  }),
  makeReview({
    id: "2",
    title: "Arrival",
    createdDate: "2024-06-30T04:46:37.751Z",
    scores: { m1: score("s3", 6), average: score("avg2", 6) },
  }),
];

/**
 * The header sort toggles. They are bare icons with no accessible name, so
 * they can only be told apart by column order — Average is the last one.
 */
const sortControls = () => within(screen.getAllByRole("row")[0]).getAllByRole("img");
const averageSortControl = () => sortControls()[sortControls().length - 1];

const renderTable = () => {
  const { host, getTable } = withReviewTable(TableView, { reviews, members });
  return { ...render(host), getTable };
};

describe("TableView", () => {
  it("renders a header per column", () => {
    renderTable();

    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Date Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Average")).toBeInTheDocument();
  });

  it("renders a row per review, in the table's current order", () => {
    renderTable();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Dune")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Arrival")).toBeInTheDocument();
  });

  it("renders each member's score and the club average in the row", () => {
    renderTable();

    const duneRow = screen.getAllByRole("row")[1];
    expect(within(duneRow).getByText("9")).toBeInTheDocument();
    expect(within(duneRow).getByText("7")).toBeInTheDocument();
    expect(within(duneRow).getByText("8")).toBeInTheDocument();
  });

  it("leaves a member's cell blank when they have not scored the work", () => {
    renderTable();

    const arrivalRow = screen.getAllByRole("row")[2];
    expect(within(arrivalRow).queryByText("7")).not.toBeInTheDocument();
  });

  it("formats the review date", () => {
    renderTable();

    expect(screen.getByText("5/28/2024")).toBeInTheDocument();
    expect(screen.getByText("6/30/2024")).toBeInTheDocument();
  });

  it("offers a sort control on every sortable column", () => {
    renderTable();

    // Poster, Title, Date Reviewed, one per member, and Average.
    expect(sortControls()).toHaveLength(6);
  });

  it("sorts descending on the first click of a column's sort control", async () => {
    const { user, getTable } = renderTable();

    await user.click(averageSortControl());

    expect(getTable()?.getState().sorting).toEqual([{ id: "score_average", desc: true }]);
  });

  it("flips to ascending when the same control is clicked again", async () => {
    const { user, getTable } = renderTable();

    await user.click(averageSortControl());
    await user.click(averageSortControl());

    expect(getTable()?.getState().sorting).toEqual([{ id: "score_average", desc: false }]);
  });

  it("swaps the neutral sort icon for a directional one", async () => {
    const { user } = renderTable();

    expect(averageSortControl()).toHaveClass("mdi-menu-down");

    await user.click(averageSortControl());
    expect(averageSortControl()).toHaveClass("mdi-arrow-down-drop-circle");

    await user.click(averageSortControl());
    expect(averageSortControl()).toHaveClass("mdi-arrow-up-drop-circle");
  });

  it("reorders the rendered rows once sorted", async () => {
    const { user } = renderTable();

    await user.click(averageSortControl());

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Dune")).toBeInTheDocument();
  });

  it("renders only the header row for a club with no reviews", () => {
    const { host } = withReviewTable(TableView, { reviews: [], members });
    render(host);

    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});
