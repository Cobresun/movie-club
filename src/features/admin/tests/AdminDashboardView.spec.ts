import { screen, waitFor, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

import { ensure } from "../../../../lib/checks/checks";
import AdminDashboardView from "../views/AdminDashboardView.vue";
import adminMetrics from "@/mocks/data/adminMetrics.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// WidgetShell mounts the v-reveal directive, which constructs a real
// IntersectionObserver — absent in jsdom.
mockIntersectionObserver();

// ag-charts reaches for a real canvas and throws on mount under jsdom. A thrown
// mount doesn't fail cleanly either — the half-rendered tree makes later queries
// in the same file report duplicate matches — so the module is replaced wholesale.
vi.mock("ag-charts-vue3", () => ({
  AgCharts: defineComponent({ name: "AgCharts", template: "<div data-testid='ag-chart' />" }),
}));

/**
 * The shared render helper stubs `router-link` with `true`, which drops the
 * default slot — and the club names in the leaderboard live inside that slot.
 * This stub keeps the link inert but renders its children.
 */
const renderDashboard = () =>
  render(AdminDashboardView, {
    global: { stubs: { "router-link": { template: "<a><slot /></a>" } } },
  });

describe("AdminDashboardView", () => {
  it("shows the site totals once metrics load", async () => {
    renderDashboard();

    expect(await screen.findByText("1,186")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText("713")).toBeInTheDocument();
    expect(screen.getByText("83% verified")).toBeInTheDocument();
  });

  it("lists the busiest clubs", async () => {
    renderDashboard();

    expect(await screen.findByText("Cobresun")).toBeInTheDocument();
    expect(screen.getByText("819")).toBeInTheDocument();
    expect(screen.getByText("2020-04-28")).toBeInTheDocument();
    expect(screen.getByText("2026-07-30")).toBeInTheDocument();
  });

  it("says a club has never reviewed rather than leaving the last-review cell blank", async () => {
    renderDashboard();

    const name = await screen.findByText("Undated Club");
    const row = ensure(name.closest("tr"), "expected the club name in a table row");

    expect(within(row).getByText("never")).toBeInTheDocument();
  });

  it("names club members, collapsing the tail once the row would get long", async () => {
    renderDashboard();

    // Two members fit; four collapse to three names plus a count.
    expect(await screen.findByText("Ada, Grace")).toBeInTheDocument();
    expect(screen.getByText("Brian Norman, Kevin, sunny +1")).toBeInTheDocument();
  });

  it("marks a club with no datable activity as unknown rather than inventing a date", async () => {
    renderDashboard();

    expect(await screen.findByText("Undated Club")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("ranks the most active people and breaks their activity down by kind", async () => {
    renderDashboard();

    const name = await screen.findByText("Cobresun Official");

    // Scoped to the row: bare counts like "34" also appear in the signup-source
    // meter, so an unscoped getByText matches two unrelated numbers.
    const row = ensure(name.closest("tr"), "expected the leaderboard name in a table row");
    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent?.trim());

    // Reviews, comments, list adds, total, clubs — the breakdown is the point
    // of the table, and a single "events" column would hide it.
    expect(cells).toEqual(expect.arrayContaining(["21", "4", "9", "34", "3"]));

    // A user with only comments is still ranked, and still shows a zero review count.
    const quiet = ensure(
      screen.getByText("Quiet Commenter").closest("tr"),
      "expected the second leaderboard row",
    );
    expect(within(quiet).getAllByRole("cell")[1]).toHaveTextContent("0");
  });

  it("shows health rates with the fraction behind them, not just a percentage", async () => {
    renderDashboard();

    // newUserActivation is 4 of 6 in the fixture.
    expect(await screen.findByText("67%")).toBeInTheDocument();
    expect(screen.getByText("4 of 6")).toBeInTheDocument();

    // Stickiness: 5 engaged in 7d against 12 in 30d.
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("reports dormant clubs against the clubs that were ever active", async () => {
    renderDashboard();

    expect(await screen.findByText("Dormant clubs")).toBeInTheDocument();
    expect(screen.getByText("of 20 that were ever active")).toBeInTheDocument();
  });

  it("withholds the time-to-first-review median when too few clubs are datable", async () => {
    server.use(
      http.get("/api/admin/metrics", () =>
        HttpResponse.json({
          ...adminMetrics,
          health: {
            ...adminMetrics.health,
            medianDaysToFirstReview: null,
            daysToFirstReviewSample: 2,
          },
        }),
      ),
    );

    renderDashboard();

    expect(await screen.findByText("Time to first review")).toBeInTheDocument();
    expect(screen.getByText(/needs a few more to mean anything/)).toBeInTheDocument();
  });

  it("shows no delta at all when history has no baseline to compare against", async () => {
    renderDashboard();

    // The default history handler returns [], so nothing can be differenced —
    // and "no baseline" must not render as "+0 this week".
    expect(await screen.findByText("1,186")).toBeInTheDocument();
    expect(screen.queryByText(/[+−]\d+ this week/)).not.toBeInTheDocument();
  });

  it("explains the situation instead of erroring when the API says 401", async () => {
    server.use(
      http.get("/api/admin/metrics", () => new HttpResponse(null, { status: 401 })),
      http.get("/api/admin/metrics/history", () => new HttpResponse(null, { status: 401 })),
    );

    renderDashboard();

    expect(await screen.findByText("Not available")).toBeInTheDocument();
    expect(screen.getByText(/limited to site administrators/)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load metrics")).not.toBeInTheDocument();
  });

  it("offers a retry when the request fails for some other reason", async () => {
    server.use(
      http.get("/api/admin/metrics", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/admin/metrics/history", () => new HttpResponse(null, { status: 500 })),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Couldn't load metrics")).toBeInTheDocument();
    });
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
});
