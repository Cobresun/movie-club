import { screen } from "@testing-library/vue";

import PersonLeaderboard from "../components/PersonLeaderboard.vue";
import type { PersonStats } from "../statsComputers";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

// Avatars are `v-lazy-load`ed, so they only take their real `src` once the
// observer reports them on screen.
mockIntersectionObserver({ intersecting: true });

function makeEntry(overrides: Partial<PersonStats> = {}): PersonStats {
  return {
    name: "Denis Villeneuve",
    workCount: 3,
    averageScore: 8.24,
    works: ["Dune", "Arrival", "Sicario"],
    ...overrides,
  };
}

const entries = [
  makeEntry(),
  makeEntry({ name: "Greta Gerwig", workCount: 1, averageScore: 6.1, works: ["Barbie"] }),
  makeEntry({
    name: "Michael Bay",
    workCount: 2,
    averageScore: 3.5,
    works: ["Ambulance", "6 Underground"],
  }),
];

describe("PersonLeaderboard", () => {
  it("lists every person with their work count and rounded average", () => {
    render(PersonLeaderboard, { props: { entries, emptyMessage: "Nothing yet." } });

    expect(screen.getByText("Denis Villeneuve")).toBeInTheDocument();
    expect(screen.getByText("8.2")).toBeInTheDocument();
    expect(screen.getByText("3 films")).toBeInTheDocument();
  });

  it("singularizes the count for a person with one work", () => {
    render(PersonLeaderboard, { props: { entries, emptyMessage: "Nothing yet." } });

    expect(screen.getByText("1 film")).toBeInTheDocument();
  });

  it("uses the caller's noun for the count", () => {
    render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet.", itemNoun: "book" },
    });

    expect(screen.getByText("3 books")).toBeInTheDocument();
    expect(screen.getByText("1 book")).toBeInTheDocument();
  });

  it("numbers people by their position in the list", () => {
    render(PersonLeaderboard, { props: { entries, emptyMessage: "Nothing yet." } });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a lazy-loaded avatar instead of a plain rank when the person has one", () => {
    render(PersonLeaderboard, {
      props: {
        entries: [makeEntry({ profileImageUrl: "https://image.tmdb.org/p/denis.jpg" })],
        emptyMessage: "Nothing yet.",
      },
    });

    expect(screen.getByRole("img", { name: "Denis Villeneuve" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/p/denis.jpg",
    );
  });

  it("keeps each person's works hidden until their row is expanded", async () => {
    const { user } = render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet." },
    });

    expect(screen.queryByText("Arrival")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button")[0]);

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("Sicario")).toBeInTheDocument();
  });

  it("collapses an expanded row when it is clicked again", async () => {
    const { user } = render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet." },
    });
    const row = screen.getAllByRole("button")[0];

    await user.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");

    await user.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Arrival")).not.toBeInTheDocument();
  });

  it("expands a row from the keyboard", async () => {
    const { user } = render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet." },
    });

    screen.getAllByRole("button")[1].focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Barbie")).toBeInTheDocument();
  });

  it("expands rows independently of one another", async () => {
    const { user } = render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet." },
    });

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(screen.getAllByRole("button")[1]);

    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("Barbie")).toBeInTheDocument();
  });

  it("shows the empty message and no rows when there is nobody to rank", () => {
    render(PersonLeaderboard, { props: { entries: [], emptyMessage: "No director data yet." } });

    expect(screen.getByText("No director data yet.")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders an optional heading above the list", () => {
    render(PersonLeaderboard, {
      props: { entries, emptyMessage: "Nothing yet.", title: "Top Directors" },
    });

    expect(screen.getByRole("heading", { name: "Top Directors" })).toBeInTheDocument();
  });

  it("omits the heading when no title is given", () => {
    render(PersonLeaderboard, { props: { entries, emptyMessage: "Nothing yet." } });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
