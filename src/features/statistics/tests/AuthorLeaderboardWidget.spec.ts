import { screen } from "@testing-library/vue";

import AuthorLeaderboardWidget from "../components/AuthorLeaderboardWidget.vue";
import { makeBook, makeExternalBook } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const bookData = [
  makeBook({
    id: "1",
    title: "Dune",
    average: 9,
    externalData: makeExternalBook({ authors: ["Frank Herbert"] }),
  }),
  makeBook({
    id: "2",
    title: "Dune Messiah",
    average: 7,
    externalData: makeExternalBook({ authors: ["Frank Herbert"] }),
  }),
  makeBook({
    id: "3",
    title: "Kindred",
    average: 6,
    externalData: makeExternalBook({ authors: ["Octavia Butler"] }),
  }),
];

describe("AuthorLeaderboardWidget", () => {
  it("ranks authors by how often the club has read them", () => {
    render(AuthorLeaderboardWidget, { props: { bookData } });

    expect(screen.getByRole("heading", { name: "Most Read Authors" })).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByText("Octavia Butler")).toBeInTheDocument();
  });

  it("counts each author's books with the book noun and averages their scores", () => {
    render(AuthorLeaderboardWidget, { props: { bookData } });

    expect(screen.getByText("2 books")).toBeInTheDocument();
    expect(screen.getByText("1 book")).toBeInTheDocument();
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("6.0")).toBeInTheDocument();
  });

  it("lists an author's titles once their row is expanded", async () => {
    const { user } = render(AuthorLeaderboardWidget, { props: { bookData } });

    await user.click(screen.getByRole("button", { name: /Frank Herbert/ }));

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Dune Messiah")).toBeInTheDocument();
  });

  it("renders nothing when no book carries author metadata", () => {
    render(AuthorLeaderboardWidget, { props: { bookData: [makeBook()] } });

    expect(screen.queryByText("Most Read Authors")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no books", () => {
    render(AuthorLeaderboardWidget, { props: { bookData: [] } });

    expect(screen.queryByText("Most Read Authors")).not.toBeInTheDocument();
  });
});
