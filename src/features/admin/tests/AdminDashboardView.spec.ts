import { screen, waitFor, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import AdminDashboardView from "../views/AdminDashboardView.vue";
import adminMetrics from "@/mocks/data/adminMetrics.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// WidgetShell mounts the v-reveal directive, which constructs a real
// IntersectionObserver — absent in jsdom.
mockIntersectionObserver();

vi.mock("ag-charts-vue3", async () => await import("@/mocks/agCharts"));

/** The Pulse tile for `label`, once the dashboard has loaded. */
const pulseTile = async (label: string) =>
  within(await screen.findByRole("group", { name: label }));

describe("AdminDashboardView", () => {
  it("leads with the range's headline numbers and how they moved", async () => {
    render(AdminDashboardView);

    const clubs = await pulseTile("Active clubs");
    expect(clubs.getByText("3")).toBeInTheDocument();
    expect(clubs.getByText("+200%")).toBeInTheDocument();
    expect(clubs.getByText("vs prior 30 days")).toBeInTheDocument();

    expect((await pulseTile("Reviews")).getByText("−20%")).toBeInTheDocument();
    // From zero, the change is absolute rather than an infinite percentage.
    expect((await pulseTile("Comments")).getByText("+5")).toBeInTheDocument();
    expect((await pulseTile("Active people")).getByText("No change")).toBeInTheDocument();
    expect(screen.getByText(/32 reviews/)).toBeInTheDocument();
  });

  it("reloads every section for the time frame picked", async () => {
    server.use(
      http.get("/api/admin/metrics", ({ request }) => {
        const range = new URL(request.url).searchParams.get("range");
        if (range !== "all") return HttpResponse.json(adminMetrics);
        return HttpResponse.json({
          ...adminMetrics,
          range: "all",
          pulse: {
            ...adminMetrics.pulse,
            activeClubs: { current: 36, previous: null },
          },
        });
      }),
    );

    const { user } = render(AdminDashboardView);
    await pulseTile("Active clubs");

    await user.click(screen.getByRole("tab", { name: "All" }));

    const clubs = await pulseTile("Active clubs");
    expect(await clubs.findByText("36")).toBeInTheDocument();
    // All time has no period before it to compare with.
    expect(clubs.queryByText(/vs prior/)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows which titles are being reviewed, rated, fought over, and queued", async () => {
    const { user } = render(AdminDashboardView);

    const reviewed = await screen.findByRole("list", { name: "Popular" });
    expect(within(reviewed).getByText("The Matrix")).toBeInTheDocument();
    expect(within(reviewed).getByText("6 reviews · 2 clubs")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Top rated" }));
    const rated = screen.getByRole("list", { name: "Top rated" });
    expect(within(rated).getAllByRole("listitem")[0]).toHaveTextContent("Dune: Part Two");
    expect(within(rated).getByLabelText("Average score 8.5")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Divisive" }));
    expect(screen.getByLabelText("Scores spread ±3.1")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Wanted" }));
    const wanted = screen.getByRole("list", { name: "Wanted" });
    expect(within(wanted).getByText("Oppenheimer")).toBeInTheDocument();
    expect(within(wanted).getByText("Queued by 3 clubs")).toBeInTheDocument();
  });

  it("says why a board is empty rather than showing a blank card", async () => {
    server.use(
      http.get("/api/admin/metrics", () =>
        HttpResponse.json({
          ...adminMetrics,
          works: { ...adminMetrics.works, highestRated: [] },
        }),
      ),
    );

    const { user } = render(AdminDashboardView);
    await screen.findByRole("list", { name: "Popular" });

    await user.click(screen.getByRole("tab", { name: "Top rated" }));

    expect(
      screen.getByText("No title has three or more reviews in the last 30 days."),
    ).toBeInTheDocument();
  });

  it("names who is in the busiest clubs and flags new ones that never got going", async () => {
    const { user } = render(AdminDashboardView);

    const busiest = await screen.findByRole("list", { name: "Busiest clubs" });
    expect(within(busiest).getByRole("link", { name: /Cobresun/ })).toBeInTheDocument();
    expect(within(busiest).getByText(/Brian Norman, Kevin, sunny \+1/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "New" }));

    const newest = screen.getByRole("list", { name: "New clubs" });
    const undated = within(newest)
      .getByRole("link", { name: /Undated Club/ })
      .closest("li");
    if (undated === null) throw new Error("expected the club in a list item");
    expect(within(undated).getByText("Not started")).toBeInTheDocument();
  });

  it("breaks each person's activity down by kind", async () => {
    const { user } = render(AdminDashboardView);

    const people = await screen.findByRole("list", { name: "Most active people" });
    expect(
      within(people).getByText("21 reviews · 4 comments · 9 list adds · 3 clubs"),
    ).toBeInTheDocument();
    // Kinds they never did are left out rather than listed as zero.
    expect(within(people).getByText("1 comment · 1 club")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Newcomers" }));

    const newcomers = screen.getByRole("list", { name: "Newcomers" });
    expect(within(newcomers).getByText("Fresh Face")).toBeInTheDocument();
    expect(within(newcomers).getByText("No activity yet")).toBeInTheDocument();
  });

  it("lists the latest reviews with their scores", async () => {
    render(AdminDashboardView);

    const feed = await screen.findByRole("list", { name: "Latest activity" });
    const [review, comment] = within(feed).getAllByRole("listitem");

    expect(review).toHaveTextContent("Brian Norman scored The Matrix");
    expect(review).toHaveTextContent("8.5");
    expect(comment).toHaveTextContent("Kevin commented on The Matrix");
  });

  it("shows health rates with the fraction behind them, and where clubs stand", async () => {
    render(AdminDashboardView);

    expect(await screen.findByText("5 of 13 people who signed in")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText(/never started/)).toBeInTheDocument();
    expect(screen.getByText(/clubs have no members left at all/)).toBeInTheDocument();
  });

  it("explains that monthly actives need snapshots before there is a trend", async () => {
    const { user } = render(AdminDashboardView);
    await pulseTile("Active clubs");

    await user.click(screen.getByRole("tab", { name: "Monthly actives" }));

    expect(await screen.findByText("No snapshots in this range yet.")).toBeInTheDocument();
  });

  it("explains the situation instead of erroring when the API says 401", async () => {
    server.use(
      http.get("/api/admin/metrics", () => new HttpResponse(null, { status: 401 })),
      http.get("/api/admin/metrics/history", () => new HttpResponse(null, { status: 401 })),
    );

    render(AdminDashboardView);

    expect(await screen.findByText("Not available")).toBeInTheDocument();
    expect(screen.getByText(/limited to site administrators/)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load metrics")).not.toBeInTheDocument();
  });

  it("offers a retry when the request fails for some other reason", async () => {
    server.use(
      http.get("/api/admin/metrics", () => new HttpResponse(null, { status: 500 })),
      http.get("/api/admin/metrics/history", () => new HttpResponse(null, { status: 500 })),
    );

    render(AdminDashboardView);

    await waitFor(() => {
      expect(screen.getByText("Couldn't load metrics")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
