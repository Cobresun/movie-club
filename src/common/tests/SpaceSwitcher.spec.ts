import { screen } from "@testing-library/vue";
import type { Router } from "vue-router";
import { useRouter } from "vue-router";

import SpaceSwitcher from "../components/SpaceSwitcher.vue";

import { ClubType } from "@/../lib/types/generated/db";
import { render } from "@/tests/utils";

// useRoute is mocked (setup.ts) to report the current club as "test-club".
const userClubs = [
  {
    clubId: "1",
    clubName: "Test Club",
    slug: "test-club",
    slugUpdatedAt: undefined,
    type: ClubType.movie,
  },
  {
    clubId: "2",
    clubName: "Other Club",
    slug: "other-club",
    slugUpdatedAt: undefined,
    type: ClubType.movie,
  },
];

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ userClubs }),
}));

vi.mock("@/common/composables/useLastClubSlug", () => ({
  setLastClubSlug: vi.fn(),
}));

// A real router so navigation runs real guards (which `useBackButtonClose`
// depends on to detect that the overlay closed because of a navigation).
const makeRealRouter = async () => {
  const { createMemoryHistory, createRouter } =
    await vi.importActual<typeof import("vue-router")>("vue-router");
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "Home", component: { template: "<div />" } },
      {
        path: "/club/:clubSlug",
        name: "ClubHome",
        component: { template: "<div />" },
      },
      { path: "/me", name: "MyLibrary", component: { template: "<div />" } },
      { path: "/new", name: "NewClub", component: { template: "<div />" } },
    ],
  });
  await router.push({ name: "ClubHome", params: { clubSlug: "test-club" } });
  return router;
};

describe("SpaceSwitcher (mobile)", () => {
  let back: ReturnType<typeof vi.spyOn>;
  let router: Router;

  beforeEach(async () => {
    // matchMedia is mocked to `matches: false`, so `useIsDesktop` reports mobile
    // and the bottom-sheet path renders.
    vi.spyOn(window.history, "pushState").mockImplementation(() => {});
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    router = await makeRealRouter();
    vi.mocked(useRouter).mockReturnValue(router);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches to the chosen club without the navigation being undone", async () => {
    const { user } = render(SpaceSwitcher);

    // Open the bottom sheet, then pick the other club.
    await user.click(screen.getByRole("button", { name: /Switch space/ }));
    await user.click(screen.getByRole("button", { name: /Other Club/ }));

    // The route actually changed to the selected club...
    expect(router.currentRoute.value.params.clubSlug).toBe("other-club");
    // ...and the overlay's history cleanup did not pop the entry we just added,
    // which would have cancelled the switch (the original mobile bug).
    expect(back).not.toHaveBeenCalled();
  });

  it("navigates to the pinned My Library entry without the navigation being undone", async () => {
    const { user } = render(SpaceSwitcher);

    await user.click(screen.getByRole("button", { name: /Switch space/ }));
    await user.click(screen.getByRole("button", { name: /My Library/ }));

    // The pinned entry navigates to the user library, and the sheet's history
    // cleanup did not pop the entry we just pushed (the same mobile race the
    // club switch guards against).
    expect(router.currentRoute.value.name).toBe("MyLibrary");
    expect(back).not.toHaveBeenCalled();
  });
});
