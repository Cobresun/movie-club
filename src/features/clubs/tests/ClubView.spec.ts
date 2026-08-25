import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubView from "../views/ClubView.vue";
import members from "@/mocks/data/members.json";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

beforeEach(() => {
  server.use(
    http.post("/api/club/:id/invite", () => HttpResponse.json({ token: "test-invite-token-123" })),
  );
});

describe("ClubView", () => {
  it("shows a loading spinner while members are loading", async () => {
    server.use(
      http.get("/api/club/:id/members", async () => {
        await new Promise(() => {
          /* never resolves */
        });
        return HttpResponse.json([]);
      }),
    );

    render(ClubView);

    expect(await screen.findByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders every member's name", async () => {
    render(ClubView);

    expect(await screen.findByText("dev")).toBeInTheDocument();
    members.forEach((member) => {
      expect(screen.getByText(member.name)).toBeInTheDocument();
    });
  });

  it("shows the shareable invite link", async () => {
    render(ClubView);

    expect(await screen.findByDisplayValue(/join-club\/test-invite-token-123/)).toBeInTheDocument();
  });

  it("offers the club actions", async () => {
    render(ClubView);

    expect(await screen.findByRole("link", { name: "Club settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave club" })).toBeInTheDocument();
  });

  it("confirms before leaving the club", async () => {
    const { user } = render(ClubView);

    await user.click(await screen.findByRole("button", { name: "Leave club" }));

    expect(screen.getByText("Leave club?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });
});
