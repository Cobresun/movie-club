import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ClubSettingsView from "../views/ClubSettingsView.vue";

import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

beforeEach(() => {
  // useInviteToken POSTs for an invite link; not in the baseline handlers.
  server.use(
    http.post("/api/club/:id/invite", () =>
      HttpResponse.json({ token: "invite-abc123" }),
    ),
  );
});

describe("ClubSettingsView", () => {
  it("renders the settings sections and club members", async () => {
    render(ClubSettingsView);

    expect(
      await screen.findByRole("heading", { name: "Members" }),
    ).toBeInTheDocument();
    // Baseline /members returns dev, user, cole (loaded asynchronously).
    expect(await screen.findByText("cole")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Club Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Club URL" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Features" }),
    ).toBeInTheDocument();
  });

  it("saves an edited club name", async () => {
    let body: unknown = null;
    server.use(
      http.put("/api/club/:id/name", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const { user } = render(ClubSettingsView);

    const nameInput = await screen.findByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Club");

    // Name "Save" is the first of the two Save buttons (Club Name section).
    await user.click(screen.getAllByRole("button", { name: "Save" })[0]);

    await waitFor(() => {
      expect(body).toMatchObject({ name: "Renamed Club" });
    });
  });

  it("opens the leave-club confirmation", async () => {
    const { user } = render(ClubSettingsView);

    await user.click(await screen.findByRole("button", { name: "Leave Club" }));

    expect(await screen.findByText("Leave Club?")).toBeInTheDocument();
  });
});
