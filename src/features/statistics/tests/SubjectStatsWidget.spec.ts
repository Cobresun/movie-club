import { screen } from "@testing-library/vue";

import SubjectStatsWidget from "../components/SubjectStatsWidget.vue";
import { makeBook, makeExternalBook } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const book = (id: string, subjects: string[], average: number) =>
  makeBook({ id, average, externalData: makeExternalBook({ subjects }) });

// A subject needs two books before it can be scored.
const bookData = [
  book("1", ["Science Fiction"], 9),
  book("2", ["Science Fiction"], 8),
  book("3", ["Memoir"], 5),
  book("4", ["Memoir"], 4),
  book("5", ["Memoir"], 6),
];

describe("SubjectStatsWidget", () => {
  it("opens on the top-rated subjects with their averages and counts", () => {
    render(SubjectStatsWidget, { props: { bookData } });

    expect(screen.getByRole("heading", { name: "Subjects" })).toBeInTheDocument();
    expect(screen.getByText("Average score per subject (2+ books)")).toBeInTheDocument();
    expect(screen.getByText("Science Fiction")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("2 books")).toBeInTheDocument();
  });

  it("ranks the highest scoring subject first", () => {
    render(SubjectStatsWidget, { props: { bookData } });

    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows[0]).toContain("Science Fiction");
    expect(rows[1]).toContain("Memoir");
  });

  it("switches to most-read counts", async () => {
    const { user } = render(SubjectStatsWidget, { props: { bookData } });

    await user.click(screen.getByRole("tab", { name: "Most Read" }));

    expect(screen.getByText("The subjects your club reaches for most")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows[0]).toContain("Memoir");
  });

  it("falls back to the counts tab when no subject can be scored", () => {
    // One book per subject: nothing clears the 2-book scoring minimum, but the
    // read counts still have something to show.
    render(SubjectStatsWidget, {
      props: { bookData: [book("1", ["Poetry"], 7), book("2", ["Essays"], 6)] },
    });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual(["Most Read"]);
    expect(screen.getByText("Poetry")).toBeInTheDocument();
  });

  it("singularizes a subject read once", () => {
    render(SubjectStatsWidget, {
      props: {
        bookData: [
          book("1", ["Science Fiction"], 9),
          book("2", ["Science Fiction"], 8),
          book("3", ["Poetry"], 7),
        ],
      },
    });

    expect(screen.getByText("2 books")).toBeInTheDocument();
  });

  it("renders nothing when no book carries subject metadata", () => {
    render(SubjectStatsWidget, { props: { bookData: [makeBook(), makeBook({ id: "b2" })] } });

    expect(screen.queryByRole("heading", { name: "Subjects" })).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no books", () => {
    render(SubjectStatsWidget, { props: { bookData: [] } });

    expect(screen.queryByRole("heading", { name: "Subjects" })).not.toBeInTheDocument();
  });
});
