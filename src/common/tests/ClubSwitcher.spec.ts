import { screen } from "@testing-library/vue";
import type { Router } from "vue-router";
import { useRouter } from "vue-router";

import ClubSwitcher from "../components/ClubSwitcher.vue";
import { ClubPreview } from "@/../lib/types/club";
import { ClubType } from "@/../lib/types/generated/db";
import { render, setRouteMatched } from "@/tests/utils";

// useRoute is mocked (setup.ts) to report the current club as "test-club".
const makeClub = (slug: string, name: string, type = ClubType.movie): ClubPreview => ({
  clubId: slug,
  clubName: name,
  slug,
  slugUpdatedAt: undefined,
  type,
});

const testClub = makeClub("test-club", "Test Club");
const otherClub = makeClub("other-club", "Other Club");
const bookClub = makeClub("book-club", "Book Club", ClubType.book);

const state = vi.hoisted(() => ({ userClubs: [] as unknown[] }));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => state,
}));

vi.mock("@/common/composables/useLastClubSlug", () => ({
  setLastClubSlug: vi.fn(),
}));

// A real router so navigation runs real guards (which `useBackButtonClose`
// depends on to detect that the overlay closed because of a navigation).
const makeRealRouter = async () => {
  const { createMemoryHistory, createRouter } =
    await vi.importActual<typeof import("vue-router")>("vue-router");
  const stub = { template: "<div />" };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "Home", component: stub },
      { path: "/club/:clubSlug", name: "ClubHome", component: stub },
      { path: "/club/:clubSlug/reviews", name: "Reviews", component: stub },
      { path: "/club/:clubSlug/statistics", name: "Statistics", component: stub },
      { path: "/club/:clubSlug/awards", name: "Awards", component: stub },
      { path: "/club/:clubSlug/club", name: "Club", component: stub },
      { path: "/new", name: "NewClub", component: stub },
    ],
  });
  await router.push({ name: "Reviews", params: { clubSlug: "test-club" } });
  return router;
};

const openSheet = async (user: ReturnType<typeof render>["user"]) => {
  await user.click(screen.getByRole("button", { name: /Club menu/ }));
};

describe("ClubSwitcher", () => {
  let back: ReturnType<typeof vi.spyOn>;
  let router: Router;

  beforeEach(async () => {
    // matchMedia is mocked to `matches: false`, so `useIsDesktop` reports mobile
    // and the bottom-sheet path renders.
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    state.userClubs = [testClub, otherClub];

    router = await makeRealRouter();
    vi.mocked(useRouter).mockReturnValue(router);
    setRouteMatched(undefined, "Reviews");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches to the chosen club without the navigation being undone", async () => {
    const { user } = render(ClubSwitcher);

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /Other Club/ }));

    // The route actually changed to the selected club...
    expect(router.currentRoute.value.params.clubSlug).toBe("other-club");
    // ...and the overlay's history cleanup did not pop the entry we just added,
    // which would have cancelled the switch (the original mobile bug).
    expect(back).not.toHaveBeenCalled();
  });

  it("keeps you in the section you were reading", async () => {
    await router.push({ name: "Statistics", params: { clubSlug: "test-club" } });
    setRouteMatched(undefined, "Statistics");

    const { user } = render(ClubSwitcher);

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /Other Club/ }));

    expect(router.currentRoute.value.name).toBe("Statistics");
    expect(router.currentRoute.value.params.clubSlug).toBe("other-club");
  });

  it("falls back to reviews when the target club has no awards", async () => {
    state.userClubs = [testClub, bookClub];
    await router.push({ name: "Awards", params: { clubSlug: "test-club" } });
    setRouteMatched(undefined, "Awards");

    const { user } = render(ClubSwitcher);

    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /Book Club/ }));

    expect(router.currentRoute.value.name).toBe("Reviews");
    expect(router.currentRoute.value.params.clubSlug).toBe("book-club");
  });

  describe("the club panel", () => {
    it("opens the club page from the club row", async () => {
      const { user } = render(ClubSwitcher);

      await openSheet(user);
      await user.click(screen.getByRole("button", { name: /Members & settings/ }));

      expect(router.currentRoute.value.name).toBe("Club");
      expect(router.currentRoute.value.params.clubSlug).toBe("test-club");
      // The sheet's history cleanup must not undo the navigation it just made.
      expect(back).not.toHaveBeenCalled();
    });

    it("leaves members and inviting to the club page", async () => {
      const { user } = render(ClubSwitcher);

      await openSheet(user);

      expect(screen.queryByRole("button", { name: /Invite people/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Club settings/ })).not.toBeInTheDocument();
    });
  });

  describe("with a single club", () => {
    beforeEach(() => {
      state.userClubs = [testClub];
    });

    it("opens the same panel, without a list to switch between", async () => {
      const { user } = render(ClubSwitcher);

      await openSheet(user);

      expect(screen.getByRole("button", { name: /Members & settings/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create new club/ })).toBeInTheDocument();
      expect(screen.queryByText("Your clubs")).not.toBeInTheDocument();
    });
  });
});
