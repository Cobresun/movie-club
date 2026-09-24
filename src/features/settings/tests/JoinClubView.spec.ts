import { screen, waitFor } from "@testing-library/vue";
import { delay, http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import JoinClubView from "../views/JoinClubView.vue";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

const clubDetailsResponse = {
  clubId: "42",
  clubName: "Science Fiction Book Club",
  type: "movie",
};

describe("JoinClubView", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/club/joinInfo/:token", () => HttpResponse.json(clubDetailsResponse)),
      http.get("/api/member/clubs", () => HttpResponse.json([])),
    );
  });

  it("shows a login prompt when the user is not logged in", () => {
    render(JoinClubView);

    expect(screen.getByText("Please log in to join this club")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });

  it("shows the invite once the user is logged in", async () => {
    const { pinia } = render(JoinClubView);
    logIn(pinia);

    expect(await screen.findByText(/Science Fiction Book Club/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Club" })).toBeInTheDocument();
    expect(screen.queryByText("Please log in to join this club")).not.toBeInTheDocument();
  });

  it("shows an error message when the invite token is invalid", async () => {
    server.use(
      http.get("/api/club/joinInfo/:token", () => new HttpResponse(null, { status: 404 })),
    );

    const { pinia } = render(JoinClubView);
    logIn(pinia);

    expect(await screen.findByText("The invite token is invalid or expired.")).toBeInTheDocument();
  });

  it("sends a join request to the API when 'Join Club' is clicked", async () => {
    let joinRequested = false;
    server.use(
      http.post("/api/club/join", () => {
        joinRequested = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user, pinia } = render(JoinClubView);
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: "Join Club" }));

    await waitFor(() => {
      expect(joinRequested).toBe(true);
    });
  });

  it("heads into the club once the join lands, without waiting on the clubs refetch", async () => {
    let clubsRequests = 0;
    server.use(
      http.get("/api/club/joinInfo/:token", () =>
        HttpResponse.json({ ...clubDetailsResponse, slug: "sci-fi" }),
      ),
      http.get("/api/member/clubs", async () => {
        clubsRequests += 1;
        if (clubsRequests > 1) await delay("infinite");
        return HttpResponse.json([]);
      }),
      http.post("/api/club/join", () => new HttpResponse(null, { status: 200 })),
    );

    const { user, pinia } = render(JoinClubView);
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: "Join Club" }));

    await waitFor(() => {
      expect(vi.mocked(useRouter()).replace.mock.calls).toContainEqual([
        { name: "ClubHome", params: { clubSlug: "sci-fi" } },
      ]);
    });
  });
});
