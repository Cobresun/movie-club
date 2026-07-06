import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import AwardsView from "../views/AwardsView.vue";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

describe("AwardsView", () => {
  it("renders a year option for each available awards year", async () => {
    server.use(
      http.get("/api/club/:id/awards/years", () =>
        HttpResponse.json([2024, 2023]),
      ),
    );

    render(AwardsView);

    expect(
      await screen.findByRole("option", { name: "2024" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2023" })).toBeInTheDocument();
  });

  it("renders the year selector even when there are no awards years yet", async () => {
    server.use(
      http.get("/api/club/:id/awards/years", () => HttpResponse.json([])),
    );

    render(AwardsView);

    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
