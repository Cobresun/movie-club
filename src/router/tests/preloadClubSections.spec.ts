import { createMemoryHistory, createRouter } from "vue-router";

import { installClubSectionPreload } from "../preloadClubSections";
import { CLUB_SECTIONS } from "@/common/clubSections";

// This spec exercises a real router, so the suite-wide `vue-router` mock in
// setup.ts (which replaces createRouter entirely) has to be lifted.
vi.unmock("vue-router");

const View = { template: "<div />" };

const buildRouter = () => {
  const loaders = CLUB_SECTIONS.map(() => vi.fn(() => Promise.resolve(View)));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "Home", component: View },
      {
        path: "/club/:clubSlug",
        component: View,
        children: CLUB_SECTIONS.map((section, i) => ({
          path: section.name.toLowerCase(),
          name: section.name,
          component: loaders[i],
        })),
      },
    ],
  });
  installClubSectionPreload(router);
  return { router, loaders };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("club section preload", () => {
  it("fetches every section's view once a club page is up", async () => {
    const { router, loaders } = buildRouter();

    await router.push({ name: "Reviews", params: { clubSlug: "test-club" } });
    await vi.runAllTimersAsync();

    expect(loaders.map((load) => load.mock.calls.length > 0)).toEqual(loaders.map(() => true));
  });

  it("fetches nothing outside a club", async () => {
    const { router, loaders } = buildRouter();

    await router.push({ name: "Home" });
    await vi.runAllTimersAsync();

    expect(loaders.map((load) => load.mock.calls.length)).toEqual(loaders.map(() => 0));
  });
});
