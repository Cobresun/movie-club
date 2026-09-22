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

  it("says who has not nominated yet and which categories are empty", async () => {
    withYear({
      step: AwardsStep.Nominations,
      awards: [
        { title: "Best Picture", nominations: [awardNominee(1, { nominatedBy: ["1"] })] },
        { title: "Best Score", nominations: [] },
      ],
    });

    render(YearView, { props });

    expect(await screen.findByText("1 of 3 members have nominated")).toBeInTheDocument();
    expect(
      screen.getByText("Waiting on user and cole. You can move on without them."),
    ).toBeInTheDocument();
    expect(screen.getByText("Best Score has no nominations yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start voting/ })).toBeEnabled();
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
  });

  it("reopens the previous phase", async () => {
    withYear({ step: AwardsStep.Ratings, awards: [{ title: "Best Picture", nominations: [] }] });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Back to nominations" }));

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Nominations"));
  });

  it("leaves the ceremony to finish itself when every category is revealed", async () => {
    withYear({ step: AwardsStep.Presentation });

    render(YearView, { props });

    expect(await screen.findByRole("button", { name: "Back to voting" })).toBeInTheDocument();
    expect(within(controls()).getAllByRole("button")).toHaveLength(1);
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
