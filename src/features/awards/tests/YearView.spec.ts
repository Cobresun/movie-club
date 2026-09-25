import { screen, waitFor, within } from "@testing-library/vue";
import { useRouter } from "vue-router";

import { AwardsStep, ClubAwards } from "../../../../lib/types/awards";
import YearView from "../views/YearView.vue";
import { awardNominee, awardsApi, awardsYear } from "@/mocks/awards";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const props = { clubSlug: "test-club", year: "2024" };

const withYear = (overrides: Partial<ClubAwards>) =>
  server.use(...awardsApi([awardsYear(2024, overrides)]));

const currentPhase = async () =>
  within(await screen.findByRole("list", { name: "Awards progress" })).getByRole("listitem", {
    current: "step",
  });

const controls = () => screen.getByRole("region", { name: "Phase controls" });

describe("YearView", () => {
  it("shows where the year is and what to do next", async () => {
    withYear({ awards: [{ title: "Best Picture", nominations: [] }] });

    render(YearView, { props });

    expect(await currentPhase()).toHaveTextContent("Categories");
    expect(within(controls()).getByText("1 category")).toBeInTheDocument();
    expect(vi.mocked(useRouter()).replace.mock.calls).toContainEqual([
      { name: "AwardsCategories" },
    ]);
  });

  it("will not open nominations until there is a category", async () => {
    withYear({ awards: [] });

    render(YearView, { props });

    expect(await screen.findByRole("button", { name: /Open nominations/ })).toBeDisabled();
    expect(
      screen.getByText("Add at least one category before opening nominations"),
    ).toBeInTheDocument();
  });

  it("opens nominations and takes everyone to them", async () => {
    withYear({ awards: [{ title: "Best Picture", nominations: [] }] });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: /Open nominations/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Categories will be locked for good/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Open nominations" }));

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Nominations"));
    const [categories] = within(screen.getByRole("list", { name: "Awards progress" })).getAllByRole(
      "listitem",
    );
    expect(categories).toHaveTextContent("Categories (done)");
    expect(await currentPhase()).not.toHaveTextContent("(done)");
    expect(vi.mocked(useRouter()).replace.mock.calls).toContainEqual([
      { name: "AwardsNominations" },
    ]);
  });

  it("holds nominations open until every member has a nominee in every category", async () => {
    withYear({
      step: AwardsStep.Nominations,
      awards: [
        { title: "Best Picture", nominations: [awardNominee(1, { nominatedBy: ["1", "2"] })] },
        { title: "Best Score", nominations: [awardNominee(2, { nominatedBy: ["1", "3"] })] },
      ],
    });

    render(YearView, { props });

    expect(await screen.findByText("1 of 3 members have finished nominating")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting on user and cole. The club moves on once everyone is done."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start voting/ })).toBeDisabled();
  });

  it("opens voting once everyone has nominated", async () => {
    const everyone = ["1", "2", "3"];
    withYear({
      step: AwardsStep.Nominations,
      awards: [
        { title: "Best Picture", nominations: [awardNominee(1, { nominatedBy: everyone })] },
        { title: "Best Score", nominations: [awardNominee(2, { nominatedBy: everyone })] },
      ],
    });

    const { user } = render(YearView, { props });

    expect(await screen.findByText("3 of 3 members have finished nominating")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Start voting/ }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Start voting" }),
    );

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Voting"));
  });

  it("counts a member as done voting once every contested category is ranked", async () => {
    withYear({
      step: AwardsStep.Ratings,
      awards: [
        {
          title: "Best Picture",
          nominations: [
            awardNominee(1, { nominatedBy: ["1"], ranking: { "1": 1, "3": 2 } }),
            awardNominee(2, { nominatedBy: ["3"], ranking: { "1": 2 } }),
          ],
        },
        // A single nominee wins by default, so nobody has to rank it.
        { title: "Best Score", nominations: [awardNominee(3, { nominatedBy: ["2"] })] },
      ],
    });

    render(YearView, { props });

    expect(await screen.findByText("1 of 3 members have finished voting")).toBeInTheDocument();
    expect(screen.getByText(/Waiting on user and cole/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start the ceremony/ })).toBeDisabled();
  });

  it("stays put when the member backs out of the confirmation", async () => {
    withYear({ awards: [{ title: "Best Picture", nominations: [] }] });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: /Open nominations/ }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await currentPhase()).toHaveTextContent("Categories");
  });

  it("offers no way back to an earlier phase", async () => {
    withYear({ step: AwardsStep.Ratings, awards: [{ title: "Best Picture", nominations: [] }] });

    render(YearView, { props });

    expect(await screen.findByRole("button", { name: /Start the ceremony/ })).toBeInTheDocument();
    expect(within(controls()).getAllByRole("button")).toHaveLength(1);
  });

  it("leaves the ceremony to finish itself when every category is revealed", async () => {
    withYear({ step: AwardsStep.Presentation });

    render(YearView, { props });

    expect(await currentPhase()).toHaveTextContent("Ceremony");
    expect(screen.queryByRole("region", { name: "Phase controls" })).not.toBeInTheDocument();
  });

  it("deletes the year after confirming", async () => {
    withYear({});

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Delete 2024 awards" }));
    expect(screen.getByRole("heading", { name: "Delete 2024 awards?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([{ name: "Awards" }]);
    });
  });
});
