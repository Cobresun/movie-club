import { screen, waitFor } from "@testing-library/vue";
import { useRoute, useRouter } from "vue-router";

import AwardsView from "../views/AwardsView.vue";
import { awardsApi, awardsYear } from "@/mocks/awards";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const withYears = (...years: number[]) =>
  server.use(...awardsApi(years.map((year) => awardsYear(year))));

const thisYear = new Date().getFullYear();

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

  it("opens this year's awards from the empty state and takes the club to it", async () => {
    withYears();

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "Start your first awards" }));
    expect(screen.getByRole("textbox", { name: "Year" })).toHaveValue(String(thisYear));
    expect(screen.getByRole("radio", { name: /Suggested categories/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: `Start ${thisYear} awards` }));

    expect(await screen.findByRole("option", { name: String(thisYear) })).toBeInTheDocument();
    expect(vi.mocked(useRouter()).push.mock.calls).toContainEqual([
      { name: "AwardsYear", params: { clubSlug: "test-club", year: String(thisYear) } },
    ]);
  });

  it("offers last year's categories when starting a new year", async () => {
    server.use(
      ...awardsApi([
        awardsYear(2024, {
          awards: [
            { title: "Best Picture", nominations: [] },
            { title: "Funniest Movie", nominations: [] },
          ],
        }),
      ]),
    );
    useRoute().params.year = "2024";

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "New awards" }));

    expect(
      await screen.findByRole("radio", { name: "The same categories as 2024" }),
    ).toHaveAccessibleDescription("Best Picture, Funniest Movie");
  });

  it.each([
    ["a year that is not four digits", "24", "Enter a four-digit year"],
    ["a year the club already has", "2024", "This club already has awards for that year"],
  ])("refuses %s", async (_label, typed, message) => {
    withYears(2024);
    useRoute().params.year = "2024";

    const { user } = render(AwardsView);

    await user.click(await screen.findByRole("button", { name: "New awards" }));
    const year = screen.getByRole("textbox", { name: "Year" });
    await user.clear(year);
    await user.type(year, typed);
    await user.click(screen.getByRole("button", { name: `Start ${typed} awards` }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(vi.mocked(useRouter()).push.mock.calls).toHaveLength(0);
  });
});
