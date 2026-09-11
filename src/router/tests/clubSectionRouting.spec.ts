import type { RouteLocationNamedRaw, Router } from "vue-router";

import { setLastClubSection } from "@/common/composables/useLastClubSlug";

// This spec exercises the real router, so the suite-wide `vue-router` mock in
// setup.ts (which replaces createRouter entirely) has to be lifted.
vi.unmock("vue-router");

const loadRouter = async () => (await import("@/router")).default;

// `resolve` matches a path but does not follow redirects, so ask the matched
// record where it would send the navigation.
const redirectTargetOf = (router: Router, path: string): RouteLocationNamedRaw => {
  const resolved = router.resolve(path);
  const record = resolved.matched[resolved.matched.length - 1];
  if (typeof record.redirect !== "function") {
    throw new Error(`${path} resolved to ${String(record.name)}, which does not redirect`);
  }
  return record.redirect(resolved, router.currentRoute.value) as RouteLocationNamedRaw;
};

beforeEach(() => {
  localStorage.clear();
});

describe("club section routing", () => {
  it("sends a bare club URL to reviews by default", async () => {
    const router = await loadRouter();

    expect(redirectTargetOf(router, "/club/test-club")).toEqual({
      name: "Reviews",
      params: { clubSlug: "test-club" },
    });
  });

  it("sends a bare club URL to the section last read in that club", async () => {
    setLastClubSection("test-club", "Statistics");
    setLastClubSection("other-club", "Watchlists");
    const router = await loadRouter();

    expect(redirectTargetOf(router, "/club/test-club").name).toBe("Statistics");
    expect(redirectTargetOf(router, "/club/other-club").name).toBe("Watchlists");
  });

  it("gives the club tab its own route", async () => {
    const router = await loadRouter();

    expect(router.resolve("/club/test-club/club").name).toBe("Club");
  });
});
