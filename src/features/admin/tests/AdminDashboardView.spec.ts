import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

import AdminDashboardView from "../views/AdminDashboardView.vue";
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
  });

  it("marks a club with no datable activity as unknown rather than inventing a date", async () => {
    renderDashboard();

    expect(await screen.findByText("Undated Club")).toBeInTheDocument();
    expect(screen.getByText("unknown")).toBeInTheDocument();
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
