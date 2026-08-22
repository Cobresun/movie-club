import { screen } from "@testing-library/vue";

import ReviewerLeaderboardWidget from "../components/ReviewerLeaderboardWidget.vue";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  makeMember({ id: "m1", name: "Ada Lovelace" }),
  makeMember({ id: "m2", name: "Alan Turing" }),
];

const workData = [
  makeMovie({ id: "1", userScores: { m1: 9, m2: 4 } }),
  makeMovie({ id: "2", userScores: { m1: 8, m2: 3 } }),
];

describe("ReviewerLeaderboardWidget", () => {
  it("lists members with their average score and review count", () => {
    render(ReviewerLeaderboardWidget, { props: { workData, members } });

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getAllByText("2 reviews")).toHaveLength(2);
  });

  it("ranks the most generous member first", () => {
    render(ReviewerLeaderboardWidget, { props: { workData, members } });

    const names = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(names[0]).toContain("Ada Lovelace");
    expect(names[1]).toContain("Alan Turing");
  });

  it("badges the extremes as The Softie and The Hater", () => {
    render(ReviewerLeaderboardWidget, { props: { workData, members } });

    expect(screen.getByText("The Softie")).toBeInTheDocument();
    expect(screen.getByText("The Hater")).toBeInTheDocument();
  });

  it("awards no badges when only one member has reviewed", () => {
    render(ReviewerLeaderboardWidget, {
      props: { workData: [makeMovie({ userScores: { m1: 7 } })], members },
    });

    expect(screen.queryByText("The Softie")).not.toBeInTheDocument();
    expect(screen.queryByText("The Hater")).not.toBeInTheDocument();
  });

  it("singularizes a single review", () => {
    render(ReviewerLeaderboardWidget, {
      props: { workData: [makeMovie({ userScores: { m1: 7, m2: 5 } })], members },
    });

    expect(screen.getAllByText("1 review")).toHaveLength(2);
  });

  it("omits members who have not scored anything", () => {
    render(ReviewerLeaderboardWidget, {
      props: {
        workData: [makeMovie({ userScores: { m1: 7 } })],
        members: [...members, makeMember({ id: "m3", name: "Grace Hopper" })],
      },
    });

    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();
    expect(screen.queryByText("Alan Turing")).not.toBeInTheDocument();
  });

  it("renders nothing when no member has scored anything", () => {
    render(ReviewerLeaderboardWidget, { props: { workData: [makeMovie()], members } });

    expect(screen.queryByText("Reviewer Stats")).not.toBeInTheDocument();
  });
});
