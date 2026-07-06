import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubHomeView from "../views/ClubHomeView.vue";

import members from "@/mocks/data/members.json";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// useInviteToken uses POST /api/club/:id/invite
beforeEach(() => {
  server.use(
    http.post("/api/club/:id/invite", () =>
      HttpResponse.json({ token: "test-invite-token-123" }),
    ),
  );
});

describe("ClubHomeView", () => {
  it("shows a loading spinner while members are loading", () => {
    server.use(
      http.get("/api/club/:id/members", async () => {
        await new Promise(() => {
          /* never resolves */
        });
        return HttpResponse.json([]);
      }),
    );

    const { container } = render(ClubHomeView);
    // LoadingSpinner renders a .lds-spinner div
    expect(container.querySelector(".lds-spinner")).toBeInTheDocument();
  });

  it("renders member names after loading", async () => {
    render(ClubHomeView);

    expect(await screen.findByText("dev")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("renders 4 router-link stubs for core sections (no awards)", async () => {
    // Reviews, Watchlists, Statistics, ClubSettings
    const { container } = render(ClubHomeView);

    await screen.findByText("dev");

    const links = container.querySelectorAll("router-link-stub");
    expect(links.length).toBe(4);
  });

  it("renders 5 router-link stubs when awards feature is enabled", async () => {
    server.use(
      http.get("/api/club/:id/settings", () =>
        HttpResponse.json({ features: { awards: true } }),
      ),
    );

    const { container } = render(ClubHomeView);

    await screen.findByText("dev");

    const links = container.querySelectorAll("router-link-stub");
    expect(links.length).toBe(5);
  });

  it("opens invite modal when the plus pill is clicked", async () => {
    const { user, container } = render(ClubHomeView);

    // Wait for members to load
    await screen.findByText("dev");

    // The invite pill is a div with @click="showInviteModal = true"
    const plusPill = container.querySelector(
      ".rounded-full.border-2.border-slate-600.bg-gray-500",
    );
    expect(plusPill).toBeInTheDocument();
    if (plusPill) {
      await user.click(plusPill);
    }

    expect(await screen.findByText("Invite Members")).toBeInTheDocument();
    expect(screen.getByText(/Share this link/i)).toBeInTheDocument();
  });

  it("shows the invite link input after opening invite modal", async () => {
    const { user, container } = render(ClubHomeView);

    await screen.findByText("dev");

    const plusPill = container.querySelector(
      ".rounded-full.border-2.border-slate-600.bg-gray-500",
    );
    if (plusPill) await user.click(plusPill);

    const input = await screen.findByDisplayValue(
      /join-club\/test-invite-token-123/,
    );
    expect(input).toBeInTheDocument();
  });

  it("renders all member names", async () => {
    render(ClubHomeView);

    await screen.findByText("dev");

    members.forEach((m) => {
      expect(screen.getByText(m.name)).toBeInTheDocument();
    });
  });
});
