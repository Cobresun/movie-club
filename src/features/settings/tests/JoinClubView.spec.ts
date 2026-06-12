import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import JoinClubView from "../views/JoinClubView.vue";

import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

const clubDetailsResponse = {
  clubId: "42",
  clubName: "Science Fiction Book Club",
  type: "movie",
};

describe("JoinClubView", () => {
  beforeEach(() => {
    server.use(
      http.get("/api/club/joinInfo/:token", () =>
        HttpResponse.json(clubDetailsResponse),
      ),
      http.get("/api/member/clubs", () => HttpResponse.json([])),
    );
  });

  it("shows a login prompt when the user is not logged in", () => {
    render(JoinClubView);

    expect(
      screen.getByText("Please log in to join this club"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });

  it("calls auth.login when 'Log In' is clicked", async () => {
    const { user, pinia } = render(JoinClubView);
    const authStore = useAuthStore(pinia);
    vi.mocked(authStore.login).mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: "Log In" }));

    expect(authStore.login).toHaveBeenCalled();
  });

  it("shows the club name and Join button when logged in and invite is valid", async () => {
    const { pinia } = render(JoinClubView);
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Override readonly computed for testing
    authStore.isLoggedIn = true;

    expect(
      await screen.findByText(/Science Fiction Book Club/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join Club" }),
    ).toBeInTheDocument();
  });

  it("shows an error message when the invite token is invalid", async () => {
    server.use(
      http.get(
        "/api/club/joinInfo/:token",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const { pinia } = render(JoinClubView);
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Override readonly computed for testing
    authStore.isLoggedIn = true;

    expect(
      await screen.findByText("The invite token is invalid or expired."),
    ).toBeInTheDocument();
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
    const authStore = useAuthStore(pinia);
    // @ts-expect-error Override readonly computed for testing
    authStore.isLoggedIn = true;

    await user.click(await screen.findByRole("button", { name: "Join Club" }));

    await waitFor(() => {
      expect(joinRequested).toBe(true);
    });
  });
});
