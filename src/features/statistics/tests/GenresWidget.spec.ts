import { screen } from "@testing-library/vue";

import GenresWidget from "../components/GenresWidget.vue";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [makeMember({ id: "m1", name: "Ada" }), makeMember({ id: "m2", name: "Alan" })];

// A genre needs two movies to rank at all, so each appears twice.
const movieData = [
  makeMovie({ id: "1", genres: ["Sci-Fi"], average: 9, userScores: { m1: 10, m2: 8 } }),
  makeMovie({ id: "2", genres: ["Sci-Fi"], average: 9, userScores: { m1: 10, m2: 8 } }),
  makeMovie({ id: "3", genres: ["Horror"], average: 3, userScores: { m1: 1, m2: 5 } }),
  makeMovie({ id: "4", genres: ["Horror"], average: 3, userScores: { m1: 1, m2: 5 } }),
  makeMovie({ id: "5", genres: ["Horror"], average: 3, userScores: { m1: 1, m2: 5 } }),
];

const props = { movieData, members };

describe("GenresWidget", () => {
  it("opens on the top-rated view, split into most and least loved", () => {
    render(GenresWidget, { props });

    expect(screen.getByRole("heading", { name: "Genres" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Top Rated" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Most Loved")).toBeInTheDocument();
    expect(screen.getByText("Least Loved")).toBeInTheDocument();
  });

  it("shows each genre's average score and movie count", () => {
    render(GenresWidget, { props });

    // Both genres qualify, so each appears in the Most Loved and Least Loved
    // columns.
    expect(screen.getAllByText("Sci-Fi")).toHaveLength(2);
    expect(screen.getAllByText("9")).toHaveLength(2);
    expect(screen.getAllByText("2 movies")).toHaveLength(2);
    expect(screen.getAllByText("3 movies")).toHaveLength(2);
  });

  it("rescores genres against one member's own ratings when their chip is picked", async () => {
    const { user } = render(GenresWidget, { props });

    await user.click(screen.getByRole("button", { name: /Ada/ }));

    // Ada gives Sci-Fi a 10 and Horror a 1, against club averages of 9 and 3.
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("switches to watch counts, which have no member filter", async () => {
    const { user } = render(GenresWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Most Watched" }));

    expect(screen.getByRole("heading", { name: "Most Watched" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Least Watched" })).toBeInTheDocument();
    expect(screen.queryByText("Most Loved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("still shows watch counts when no genre reaches the two-movie scoring minimum", async () => {
    const { user } = render(GenresWidget, {
      props: { members, movieData: [makeMovie({ genres: ["Documentary"], average: 8 })] },
    });

    expect(screen.getByRole("heading", { name: "Genres" })).toBeInTheDocument();
    expect(screen.queryByText("Most Loved")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Most Watched" }));
    expect(screen.getAllByText("Documentary")).toHaveLength(2);
  });

  it("renders nothing when no movie carries any genre", () => {
    render(GenresWidget, { props: { members, movieData: [makeMovie({ genres: [] })] } });

    expect(screen.queryByRole("heading", { name: "Genres" })).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no movies", () => {
    render(GenresWidget, { props: { members, movieData: [] } });

    expect(screen.queryByRole("heading", { name: "Genres" })).not.toBeInTheDocument();
  });
});
