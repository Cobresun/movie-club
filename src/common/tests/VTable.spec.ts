import { screen, within } from "@testing-library/vue";

import VTable from "../components/VTable.vue";

import { render } from "@/tests/utils";

const headers = [
  { value: "title", title: "Title" },
  { value: "score", title: "Score" },
];

const data = [
  { title: "Inception", score: 9 },
  { title: "The Matrix", score: 8 },
  { title: "Alien", score: 7 },
];

describe("VTable", () => {
  it("renders a table with header and data rows", () => {
    render(VTable, { props: { headers, data } });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
    expect(screen.getByText("Alien")).toBeInTheDocument();
  });

  it("renders without header row when header=false", () => {
    render(VTable, { props: { headers, data, header: false } });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("emits clickRow when a row is clicked", async () => {
    const { emitted, user } = render(VTable, { props: { headers, data } });

    const rows = screen.getAllByRole("row");
    // First row is the header; data rows start at index 1
    await user.click(rows[1]);

    expect(emitted("clickRow")).toBeTruthy();
  });

  it("sorts by column ascending when sort icon is clicked", async () => {
    const { container, user } = render(VTable, { props: { headers, data } });

    // Before sort: Inception is first data row
    const dataRows = () => container.querySelectorAll<HTMLElement>("tbody tr");
    expect(within(dataRows()[0]).getByText("Inception")).toBeInTheDocument();

    // Click the Score column's sort icon div (second cursor-pointer div in headers)
    const sortDivs =
      container.querySelectorAll<HTMLElement>("th .cursor-pointer");
    await user.click(sortDivs[1]);

    // After ascending sort by score: Alien(7), Matrix(8), Inception(9)
    expect(within(dataRows()[0]).getByText("Alien")).toBeInTheDocument();
  });

  it("renders slot content for header", () => {
    render(VTable, {
      props: { headers, data },
      slots: { title: "<span>Custom Title</span>" },
    });

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("renders slot content for cell items", () => {
    render(VTable, {
      props: { headers, data },
      slots: { "item-score": "<strong>rated</strong>" },
    });

    const ratedElements = screen.getAllByText("rated");
    expect(ratedElements.length).toBe(3);
  });
});
