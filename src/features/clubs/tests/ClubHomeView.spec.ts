import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubHomeView from "../views/ClubHomeView.vue";
import members from "@/mocks/data/members.json";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

beforeEach(() => {
  server.use(
    http.post("/api/club/:id/invite", () => HttpResponse.json({ token: "test-invite-token-123" })),
  );
});

const openInviteModal = async (user: ReturnType<typeof render>["user"]) => {
  await user.click(await screen.findByRole("button", { name: "Invite members" }));
};

describe("ClubHomeView", () => {
  it("shows a loading spinner while members are loading", async () => {
    server.use(
      http.get("/api/club/:id/members", async () => {
        await new Promise(() => {
          /* never resolves */
        });
        return HttpResponse.json([]);
      }),
    );

    render(ClubHomeView);

    expect(await screen.findByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders every member's name", async () => {
    render(ClubHomeView);

    expect(await screen.findByText("dev")).toBeInTheDocument();
    members.forEach((member) => {
      expect(screen.getByText(member.name)).toBeInTheDocument();
    });
  });

  it("links to each core section", async () => {
    render(ClubHomeView);

    for (const name of ["Reviews", "Lists", "Statistics", "Club Settings"]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Awards" })).not.toBeInTheDocument();
  });

  it("links to awards when the awards feature is enabled", async () => {
    server.use(
      http.get("/api/club/:id/settings", () => HttpResponse.json({ features: { awards: true } })),
    );

    render(ClubHomeView);

    expect(await screen.findByRole("link", { name: "Awards" })).toBeInTheDocument();
  });

  it("shows the shareable invite link after opening the invite modal", async () => {
    const { user } = render(ClubHomeView);

    await openInviteModal(user);

    expect(await screen.findByText("Invite Members")).toBeInTheDocument();
    expect(screen.getByText(/Share this link/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/join-club\/test-invite-token-123/)).toBeInTheDocument();
  });
});
