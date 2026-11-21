import { screen, waitFor, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import { AwardsStep, type ClubAwards } from "../../../../lib/types/awards";
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
    expect(
      await screen.findByRole("heading", { level: 2, name: "Categories" }),
    ).toBeInTheDocument();
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
    expect(
      within(dialog).getByText(
        /you can come back to this step without losing anyone's nominations/,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Open nominations" }));

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Nominations"));
    const [categories] = within(screen.getByRole("list", { name: "Awards progress" })).getAllByRole(
      "listitem",
    );
    expect(categories).toHaveTextContent("Categories (done)");
    expect(await currentPhase()).not.toHaveTextContent("(done)");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Nominations" }),
    ).toBeInTheDocument();
  });

  it("moves to the next phase before the server confirms the advance", async () => {
    withYear({ awards: [{ title: "Best Picture", nominations: [] }] });
    server.use(
      http.put("/api/club/:slug/awards/:year/step", async () => {
        await new Promise(() => {
          /* never resolves */
        });
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: /Open nominations/ }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Open nominations" }),
    );

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Nominations"));
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

  it("reopens nominations from voting without waiting on anyone", async () => {
    withYear({
      step: AwardsStep.Ratings,
      awards: [
        {
          title: "Best Picture",
          nominations: [awardNominee(1, { nominatedBy: ["1"] }), awardNominee(2)],
        },
      ],
    });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Reopen nominations" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Saved ballots are kept/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Reopen nominations" }));

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Nominations"));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Nominations" }),
    ).toBeInTheDocument();
  });

  it("goes back to categories from nominations", async () => {
    withYear({
      step: AwardsStep.Nominations,
      awards: [{ title: "Best Picture", nominations: [] }],
    });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Back to categories" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Back to categories" }),
    );

    await waitFor(async () => expect(await currentPhase()).toHaveTextContent("Categories"));
  });

  it("warns that the ceremony is the one step that can't be undone", async () => {
    withYear({ step: AwardsStep.Ratings, awards: [{ title: "Best Picture", nominations: [] }] });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: /Start the ceremony/ }));

    expect(
      within(await screen.findByRole("dialog")).getByText(/the one step that can't be undone/),
    ).toBeInTheDocument();
  });

  it("removes an empty category straight away", async () => {
    withYear({
      awards: [
        { title: "Best Picture", nominations: [] },
        { title: "Best Score", nominations: [] },
      ],
    });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Remove Best Score" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Categories" })).not.toHaveTextContent("Best Score"),
    );
  });

  it("asks before removing a category members nominated in before the club stepped back", async () => {
    withYear({
      awards: [
        { title: "Best Picture", nominations: [] },
        { title: "Best Score", nominations: [awardNominee(1, { nominatedBy: ["2"] })] },
      ],
    });

    const { user } = render(YearView, { props });

    await user.click(await screen.findByRole("button", { name: "Remove Best Score" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/removes their nominations too/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(screen.getByRole("list", { name: "Categories" })).not.toHaveTextContent("Best Score"),
    );
  });

  it("explains how awards work, open while the club picks categories", async () => {
    withYear({ awards: [{ title: "Best Picture", nominations: [] }] });

    render(YearView, { props });

    const guide = await screen.findByRole("list", { name: "How awards work" });
    expect(guide).toBeVisible();
    expect(
      within(guide)
        .getAllByRole("listitem")
        .map((step) => step.textContent),
    ).toStrictEqual([
      expect.stringContaining("Categories"),
      expect.stringContaining("Nominations"),
      expect.stringContaining("Voting"),
      expect.stringContaining("Ceremony"),
    ]);
    expect(screen.getByText(/Nothing is final until the ceremony/)).toBeVisible();
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
