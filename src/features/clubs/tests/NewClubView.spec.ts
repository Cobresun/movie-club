import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRouter } from "vue-router";

import NewClubView from "../views/NewClubView.vue";
import { ClubType } from "@/../lib/types/generated/db";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render, logIn } from "@/tests/utils";

describe("NewClubView", () => {
  it("shows a 'must be logged in' message when not authenticated", () => {
    render(NewClubView);

    expect(screen.getByText("Must be logged in to create a new club!")).toBeInTheDocument();
  });

  it("explains what a club is and names both ways in", async () => {
    const { pinia } = render(NewClubView);
    logIn(pinia);

    expect(await screen.findByText("You're not in a club yet")).toBeInTheDocument();
    expect(screen.getByText("Start a club")).toBeInTheDocument();
    expect(screen.getByText("Join one you were invited to")).toBeInTheDocument();
  });

  it("drops the onboarding framing when the user is already in a club", async () => {
    const { pinia } = render(NewClubView);
    logIn(pinia);
    const authStore = useAuthStore(pinia);
    authStore.userClubs = [
      {
        clubId: "1",
        clubName: "Test Club",
        slug: "test-club",
        slugUpdatedAt: undefined,
        type: ClubType.movie,
      },
    ];

    expect(await screen.findByText("New club")).toBeInTheDocument();
    expect(screen.queryByText("You're not in a club yet")).not.toBeInTheDocument();
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

  describe("joining by invite", () => {
    const paste = async (value: string) => {
      const { pinia, user } = render(NewClubView);
      logIn(pinia);
      await user.type(await screen.findByPlaceholderText("Paste invite link"), value);
      await user.click(screen.getByRole("button", { name: "Join" }));
      return vi.mocked(useRouter());
    };

    it("accepts a pasted invite URL", async () => {
      const router = await paste("https://movieclub.app/join-club/abc-123");

      expect(router.push.mock.calls).toContainEqual([
        { name: "JoinClub", params: { inviteToken: "abc-123" } },
      ]);
    });

    it("accepts a bare token", async () => {
      const router = await paste("abc-123");

      expect(router.push.mock.calls).toContainEqual([
        { name: "JoinClub", params: { inviteToken: "abc-123" } },
      ]);
    });

    it("explains when the pasted text is not an invite", async () => {
      const router = await paste("not an invite");

      expect(screen.getByText("That doesn't look like an invite link.")).toBeInTheDocument();
      expect(router.push.mock.calls).toEqual([]);
    });
  });
});
