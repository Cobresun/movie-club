import { screen } from "@testing-library/vue";

import ClubConsensusWidget from "../components/ClubConsensusWidget.vue";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  makeMember({ id: "m1", name: "Ada Lovelace" }),
  makeMember({ id: "m2", name: "Alan Turing" }),
];

const workData = [
  makeMovie({
    id: "1",
    title: "Unanimous",
    average: 8,
    imageUrl: "https://image.tmdb.org/unanimous.jpg",
    userScores: { m1: 8, m2: 8 },
  }),
  makeMovie({ id: "2", title: "Contentious", average: 5, userScores: { m1: 1, m2: 9 } }),
];

const props = { workData, members };

describe("ClubConsensusWidget", () => {
  it("opens on the works the club agreed on most", () => {
    render(ClubConsensusWidget, { props });

    expect(screen.getByRole("heading", { name: "Club Consensus" })).toBeInTheDocument();
    expect(screen.getByText("Scores that landed closest together")).toBeInTheDocument();
    // Both works appear, ordered by how tightly the scores clustered.
    const titles = screen
      .getAllByTitle(/Unanimous|Contentious/)
      .map((el) => el.textContent?.trim());
    expect(titles[0]).toBe("Unanimous");
  });

  it("lists every member's score by first name", () => {
    render(ClubConsensusWidget, { props });

    expect(screen.getByText("Ada: 1")).toBeInTheDocument();
    expect(screen.getByText("Alan: 9")).toBeInTheDocument();
  });

  it("shows each work's club average", () => {
    render(ClubConsensusWidget, { props });

    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });

  it("reverses the ordering in the most-divisive view", async () => {
    const { user } = render(ClubConsensusWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Most Divisive" }));

    expect(screen.getByText("Scores that split the room")).toBeInTheDocument();
    const titles = screen
      .getAllByTitle(/Unanimous|Contentious/)
      .map((el) => el.textContent?.trim());
    expect(titles[0]).toBe("Contentious");
  });

  it("renders the poster when a work has one and a placeholder otherwise", () => {
    render(ClubConsensusWidget, { props });

    expect(screen.getByRole("img", { name: "Unanimous" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/unanimous.jpg",
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("falls back to the raw member id for a scorer who has left the club", () => {
    render(ClubConsensusWidget, {
      props: {
        members: [],
        workData: [makeMovie({ title: "Orphaned", average: 6, userScores: { ghost: 6, m2: 6 } })],
      },
    });

    expect(screen.getByText("ghost: 6")).toBeInTheDocument();
  });

  it("ignores works only one member scored", () => {
    render(ClubConsensusWidget, {
      props: { members, workData: [makeMovie({ title: "Solo", userScores: { m1: 7 } })] },
    });

    expect(screen.queryByText("Club Consensus")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(ClubConsensusWidget, { props: { members, workData: [] } });

    expect(screen.queryByText("Club Consensus")).not.toBeInTheDocument();
  });
});
