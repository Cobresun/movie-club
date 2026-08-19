import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import NewClubView from "../views/NewClubView.vue";
import { server } from "@/mocks/server";
import { render, logIn } from "@/tests/utils";

describe("NewClubView", () => {
  it("shows a 'must be logged in' message when not authenticated", () => {
    render(NewClubView);

    expect(screen.getByText("Must be logged in to create a new club!")).toBeInTheDocument();
  });

  it("shows the club name input when logged in", async () => {
    const { pinia } = render(NewClubView);
    logIn(pinia);

    expect(await screen.findByPlaceholderText("Club name")).toBeInTheDocument();
  });

  it("shows a validation error when submitting with no club name", async () => {
    const { pinia, user } = render(NewClubView);
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: /Create club/i }));

    expect(screen.getByText("Club name is required")).toBeInTheDocument();
  });

  it("opens the club it just created", async () => {
    server.use(
      http.post("/api/club", async ({ request }) => {
        const { name } = (await request.json()) as { name: string };
        return HttpResponse.json({ clubId: "123", slug: name.toLowerCase().replace(/ /g, "-") });
      }),
    );

    const { pinia, user } = render(NewClubView);
    logIn(pinia);

    await user.type(await screen.findByPlaceholderText("Club name"), "My New Club");
    await user.click(screen.getByRole("button", { name: /Create club/i }));

    const router = vi.mocked(useRouter());
    await vi.waitFor(() => {
      expect(router.push.mock.calls).toContainEqual([
        { name: "ClubHome", params: { clubSlug: "my-new-club" } },
      ]);
    });
  });
});
