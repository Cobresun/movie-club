import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import WorksView from "../views/WorksView.vue";
import { groupWorks } from "../worksGrouping";

import { WorkType } from "@/../lib/types/generated/db";
import type { DiaryEntry } from "@/../lib/types/me";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const { route, push } = vi.hoisted(() => {
  const route: {
    params: Record<string, string>;
    query: Record<string, string>;
  } = { params: {}, query: {} };
  const push = vi.fn(() => Promise.resolve());
  return { route, push };
});

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push, beforeEach: vi.fn(() => vi.fn()) }),
}));

/** Two events for the same work, newest first — the latest carries score 7. */
function twoEventsForOneWork(): DiaryEntry[] {
  const work = {
    id: "w1",
    title: "Inception",
    type: WorkType.movie,
    externalId: "27205",
    imageUrl: "https://image.tmdb.org/t/p/w154/inception.jpg",
  };
  return [
    {
      reviewId: "e2",
      work,
      score: 7,
      watchedDate: "2026-07-10",
      createdDate: "2026-07-10T12:00:00.000Z",
      rewatch: true,
      text: null,
      context: { kind: "solo" },
    },
    {
      reviewId: "e1",
      work,
      score: 9,
      watchedDate: "2026-01-01",
      createdDate: "2026-01-01T12:00:00.000Z",
      rewatch: false,
      text: null,
      context: { kind: "solo" },
    },
  ];
}

describe("groupWorks", () => {
  it("collapses events for one work and keeps the latest score", () => {
    const works = groupWorks(twoEventsForOneWork());
    expect(works).toHaveLength(1);
    expect(works[0].latestScore).toBe(7);
    expect(works[0].eventCount).toBe(2);
  });
});

describe("WorksView", () => {
  afterEach(() => {
    route.query = {};
  });

  it("groups events by work and shows the latest event's score", async () => {
    server.use(
      http.get("/api/me/reviews", () =>
        HttpResponse.json(twoEventsForOneWork()),
      ),
    );

    render(WorksView);

    // One poster for the work, showing the latest score (7, not the older 9)
    // and the number of logged events.
    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.getByText("2 logs")).toBeInTheDocument();
  });
});
