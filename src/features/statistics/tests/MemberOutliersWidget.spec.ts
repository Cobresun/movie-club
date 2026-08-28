import { screen } from "@testing-library/vue";

import { ClubType } from "../../../../lib/types/generated/db";
import MemberOutliersWidget from "../components/MemberOutliersWidget.vue";
import { makeMember, makeMovie } from "./fixtures";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const members = [
  makeMember({ id: "m1", name: "Ada Lovelace" }),
  makeMember({ id: "m2", name: "Alan Turing" }),
  makeMember({ id: "m3", name: "Grace Hopper" }),
];

// A work counts as an outlier only when exactly one member sits 2+ points from
// the club average — so each fixture below has a single dissenter.
const workData = [
  makeMovie({
    id: "1",
    title: "Ada Alone Loved It",
    average: 5,
    imageUrl: "https://image.tmdb.org/ada.jpg",
    userScores: { m1: 9, m2: 3, m3: 3 },
  }),
  makeMovie({
    id: "2",
    title: "Alan Alone Loved It",
    average: 5,
    userScores: { m1: 3, m2: 9, m3: 3 },
  }),
  makeMovie({
    id: "3",
    title: "Alan Alone Hated It",
    average: 7,
    userScores: { m1: 8, m2: 3, m3: 8 },
  }),
];

const props = { workData, members, clubType: ClubType.movie };

describe("MemberOutliersWidget", () => {
  it("opens on guilty pleasures with the club's media noun", () => {
    render(MemberOutliersWidget, { props });

    expect(screen.getByRole("heading", { name: "Guilty Pleasures" })).toBeInTheDocument();
    expect(
      screen.getByText("Movies where only one member loved it (2+ points above club average)"),
    ).toBeInTheDocument();
  });

  it("offers a chip per member with outliers, and no All chip", () => {
    render(MemberOutliersWidget, { props });

    expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alan Turing/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Grace Hopper/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("shows the first member's outliers with their score and the club average", () => {
    render(MemberOutliersWidget, { props });

    expect(screen.getByText("Ada Alone Loved It")).toBeInTheDocument();
    expect(screen.getByText("Club avg: 5.0")).toBeInTheDocument();
    expect(screen.getByText("9.0")).toBeInTheDocument();
    expect(screen.getByText("+4.0")).toBeInTheDocument();
  });

  it("swaps to another member's outliers when their chip is picked", async () => {
    const { user } = render(MemberOutliersWidget, { props });

    await user.click(screen.getByRole("button", { name: /Alan Turing/ }));

    expect(screen.getByText("Alan Alone Loved It")).toBeInTheDocument();
    expect(screen.queryByText("Ada Alone Loved It")).not.toBeInTheDocument();
  });

  it("switches to curmudgeons, showing a negative delta", async () => {
    const { user } = render(MemberOutliersWidget, { props });

    await user.click(screen.getByRole("tab", { name: "Curmudgeons" }));

    expect(screen.getByRole("heading", { name: "Club Curmudgeons" })).toBeInTheDocument();
    expect(
      screen.getByText("Movies where only one member hated it (2+ points below club average)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Alan Alone Hated It")).toBeInTheDocument();
    expect(screen.getByText("-4.0")).toBeInTheDocument();
  });

  it("re-picks a member who has entries in the new mode", async () => {
    const { user } = render(MemberOutliersWidget, { props });

    // Ada is selected in guilty mode but has no curmudgeon entries, so the
    // widget falls back to the only member who does rather than showing blanks.
    await user.click(screen.getByRole("tab", { name: "Curmudgeons" }));

    expect(screen.getByRole("button", { name: /Alan Turing/, pressed: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ada Lovelace/ })).not.toBeInTheDocument();
  });

  it("uses the book club's noun in its subtitle", () => {
    render(MemberOutliersWidget, { props: { ...props, clubType: ClubType.book } });

    expect(
      screen.getByText("Books where only one member loved it (2+ points above club average)"),
    ).toBeInTheDocument();
  });

  it("offers only the curmudgeon tab when nobody has a guilty pleasure", () => {
    render(MemberOutliersWidget, { props: { ...props, workData: [workData[2]] } });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Curmudgeons",
    ]);
  });

  it("renders nothing when every work split the club evenly", () => {
    render(MemberOutliersWidget, {
      props: { ...props, workData: [makeMovie({ average: 5, userScores: { m1: 5, m2: 5 } })] },
    });

    expect(screen.queryByText("Guilty Pleasures")).not.toBeInTheDocument();
  });

  it("renders nothing for a club with no reviews", () => {
    render(MemberOutliersWidget, { props: { ...props, workData: [] } });

    expect(screen.queryByText("Guilty Pleasures")).not.toBeInTheDocument();
  });
});
