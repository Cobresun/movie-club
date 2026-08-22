import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRoute, useRouter } from "vue-router";

import AwardsView from "../views/AwardsView.vue";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const withYears = (years: number[]) =>
  server.use(http.get("/api/club/:id/awards/years", () => HttpResponse.json(years)));

describe("AwardsView", () => {
  it("renders a year option for each available awards year", async () => {
    withYears([2024, 2023]);
    useRoute().params.year = "2024";

    render(AwardsView);

    expect(await screen.findByRole("option", { name: "2024" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2023" })).toBeInTheDocument();
  });

  it("lands on the most recent year rather than an empty year selector", async () => {
    withYears([2024, 2023]);

    render(AwardsView);

    const router = vi.mocked(useRouter());
    await waitFor(() => {
      expect(router.replace.mock.calls).toContainEqual([
        { name: "AwardsYear", params: { clubSlug: "test-club", year: "2024" } },
      ]);
    });
  });

  it("keeps the year the route already names", async () => {
    withYears([2024, 2023]);
    useRoute().params.year = "2023";

    render(AwardsView);

    expect(await screen.findByRole("combobox")).toHaveValue("2023");
    expect(vi.mocked(useRouter()).replace.mock.calls).toHaveLength(0);
  });

  it("explains itself when the club has no awards years yet", async () => {
    withYears([]);

    render(AwardsView);

    expect(await screen.findByText("No awards yet")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(vi.mocked(useRouter()).replace.mock.calls).toHaveLength(0);
  });
});
