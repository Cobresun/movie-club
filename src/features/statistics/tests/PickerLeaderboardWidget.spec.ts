import { screen, within } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import PickerLeaderboardWidget from "../components/PickerLeaderboardWidget.vue";
import { makeBook, makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const alice = makeMember({ id: "a", name: "Alice" });
const bob = makeMember({ id: "b", name: "Bob" });
const members = [alice, bob];

const workData = [
  makeMovie({ id: "1", title: "Paddington 2", average: 9.5, addedBy: "a" }),
  makeMovie({ id: "2", title: "Cats", average: 2, addedBy: "a" }),
  makeMovie({ id: "3", title: "Heat", average: 8, addedBy: "b" }),
  makeMovie({ id: "4", title: "Unattributed", average: 1 }),
];

function rows() {
  return within(screen.getByRole("list", { name: "Pick leaderboard" })).getAllByRole("listitem");
}

describe("PickerLeaderboardWidget", () => {
  it("ranks members by the club average of the movies they added", () => {
    render(PickerLeaderboardWidget, { props: { workData, members, clubType: ClubType.movie } });

    const [first, second] = rows();
    expect(within(first).getByText("Bob")).toBeInTheDocument();
    expect(within(first).getByText("Best Taste")).toBeInTheDocument();
    expect(within(first).getByText("8.0")).toBeInTheDocument();
    expect(within(second).getByText("Alice")).toBeInTheDocument();
    expect(within(second).getByText("Worst Taste")).toBeInTheDocument();
    expect(within(second).getByText("5.8")).toBeInTheDocument();
  });

  it("names each member's best and worst pick", () => {
    render(PickerLeaderboardWidget, { props: { workData, members, clubType: ClubType.movie } });

    const alicesRow = rows()[1];
    expect(within(alicesRow).getByText("2 movies added")).toBeInTheDocument();
    expect(within(alicesRow).getByText("Paddington 2 (9.5)")).toBeInTheDocument();
    expect(within(alicesRow).getByText("Cats (2.0)")).toBeInTheDocument();
  });

  it("shows only a best pick for a member who added one movie", () => {
    render(PickerLeaderboardWidget, { props: { workData, members, clubType: ClubType.movie } });

    const bobsRow = rows()[0];
    expect(within(bobsRow).getByText("1 movie added")).toBeInTheDocument();
    expect(within(bobsRow).getByText("Heat (8.0)")).toBeInTheDocument();
    expect(within(bobsRow).queryByText("Worst pick")).not.toBeInTheDocument();
  });

  it("leaves out works nobody is credited with and members who have left", () => {
    render(PickerLeaderboardWidget, {
      props: {
        workData: [...workData, makeMovie({ id: "5", title: "Gone Girl", addedBy: "left" })],
        members,
        clubType: ClubType.movie,
      },
    });

    expect(rows()).toHaveLength(2);
    expect(screen.queryByText(/Unattributed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gone Girl/)).not.toBeInTheDocument();
  });

  it("uses the club's noun for a book club", () => {
    render(PickerLeaderboardWidget, {
      props: {
        workData: [
          makeBook({ id: "1", title: "Dune", addedBy: "a" }),
          makeBook({ id: "2", title: "Emma", addedBy: "b" }),
        ],
        members,
        clubType: ClubType.book,
      },
    });

    expect(screen.getByText("Club average for the books each member added")).toBeInTheDocument();
    expect(screen.getAllByText("1 book added")).toHaveLength(2);
  });

  it("renders nothing until two members have added something", () => {
    render(PickerLeaderboardWidget, {
      props: { workData: workData.slice(0, 2), members, clubType: ClubType.movie },
    });

    expect(screen.queryByText("Who Picks Best?")).not.toBeInTheDocument();
  });
});
