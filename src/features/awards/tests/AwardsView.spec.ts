import { screen, waitFor, within } from "@testing-library/vue";
import { useRoute, useRouter } from "vue-router";

import AwardsView from "../views/AwardsView.vue";
import { awardsApi, awardsYear } from "@/mocks/awards";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const withYears = (...years: number[]) =>
  server.use(...awardsApi(years.map((year) => awardsYear(year))));

describe("AwardsView", () => {
  it("renders a year option for each available awards year", async () => {
    withYears(2024, 2023);
    useRoute().params.year = "2024";

    render(AwardsView);

    expect(await screen.findByRole("option", { name: "2024" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2023" })).toBeInTheDocument();
  });

  it("lands on the most recent year rather than an empty year selector", async () => {
    withYears(2024, 2023);

    render(AwardsView);

    const router = vi.mocked(useRouter());
    await waitFor(() => {
      expect(router.replace.mock.calls).toContainEqual([
        { name: "AwardsYear", params: { clubSlug: "test-club", year: "2024" } },
      ]);
    });
  });

  it("keeps the year the route already names", async () => {
    withYears(2024, 2023);
    useRoute().params.year = "2023";

    render(AwardsView);

    expect(await screen.findByRole("combobox", { name: "Awards year" })).toHaveValue("2023");
    expect(vi.mocked(useRouter()).replace.mock.calls).toHaveLength(0);
  });

  it("explains itself when the club has no awards years yet", async () => {
    withYears();

    render(AwardsView);

    expect(await screen.findByText("No awards yet")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(vi.mocked(useRouter()).replace.mock.calls).toHaveLength(0);
  });

  it("opens a year the club reviewed movies in and takes the club to it", async () => {
    server.use(...awardsApi([], [2023, 2025]));

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "Start your first awards" }));
    const year = await screen.findByRole("combobox", { name: "Year" });
    expect(year).toHaveValue("2025");
    expect(
      within(year)
        .getAllByRole("option")
        .map((option) => option.textContent?.trim()),
    ).toEqual(["2025", "2023"]);
    expect(screen.getByRole("radio", { name: "Suggested categories" })).toBeChecked();

    await user.selectOptions(year, "2023");
    await user.click(screen.getByRole("button", { name: "Start 2023 awards" }));

    expect(await screen.findByRole("option", { name: "2023" })).toBeInTheDocument();
    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([
      { name: "AwardsYear", params: { clubSlug: "test-club", year: "2023" } },
    ]);
  });

  it("only offers years that do not have awards yet", async () => {
    server.use(...awardsApi([awardsYear(2024)], [2024, 2023]));
    useRoute().params.year = "2024";

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "New awards" }));

    const year = await screen.findByRole("combobox", { name: "Year" });
    expect(
      within(year)
        .getAllByRole("option")
        .map((option) => option.textContent?.trim()),
    ).toEqual(["2023"]);
  });

  it("explains that there is nothing to open before the club has reviewed a movie", async () => {
    withYears();

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "Start your first awards" }));

    expect(
      await screen.findByText(
        "The club hasn't reviewed any movies yet. Once it has, you can hold awards for that year.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Start \d{4} awards$/ })).not.toBeInTheDocument();
  });

  it("explains that every reviewed year already has awards", async () => {
    server.use(...awardsApi([awardsYear(2024)], [2024]));
    useRoute().params.year = "2024";

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "New awards" }));

    expect(
      await screen.findByText("Every year the club reviewed movies in already has awards."),
    ).toBeInTheDocument();
  });

  it("offers last year's categories when starting a new year", async () => {
    server.use(
      ...awardsApi(
        [
          awardsYear(2024, {
            awards: [
              { title: "Best Picture", nominations: [] },
              { title: "Funniest Movie", nominations: [] },
            ],
          }),
        ],
        [2024, 2025],
      ),
    );
    useRoute().params.year = "2024";

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "New awards" }));

    expect(
      await screen.findByRole("radio", { name: "The same categories as 2024" }),
    ).toHaveAccessibleDescription("Best Picture, Funniest Movie");
  });
});
