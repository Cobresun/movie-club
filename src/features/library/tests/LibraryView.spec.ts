import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import LibraryView from "../views/LibraryView.vue";
import { groupWorks } from "../worksGrouping";

import { WorkType } from "@/../lib/types/generated/db";
import type { DiaryWatch } from "@/../lib/types/me";
import type { DetailedMovieData } from "@/../lib/types/movie";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

// A real-ish route we can mutate per test (the global setup mock has no
// `query`, which the ?type= filter reads). useRouter keeps the `beforeEach`
// stub `useBackButtonClose` needs for the bottom-sheet overlays.
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

/**
 * Two watches of the same work, newest first — the latest carries score 7 and
 * two club reviews of that same viewing (which share the watch's score).
 */
function twoWatchesForOneWork(): DiaryWatch[] {
  const work = {
    id: "w1",
    title: "Inception",
    type: WorkType.movie,
    externalId: "27205",
    imageUrl: "https://image.tmdb.org/t/p/w154/inception.jpg",
  };
  return [
    {
      watchId: "watch-2",
      work,
      score: 7,
      watchedDate: "2026-07-10",
      createdDate: "2026-07-10T12:00:00.000Z",
      rewatch: true,
      text: null,
      clubReviews: [
        {
          reviewId: "r1",
          clubId: "1",
          clubName: "Test Club",
          clubSlug: "test-club",
          createdDate: "2026-07-11T12:00:00.000Z",
        },
        {
          reviewId: "r2",
          clubId: "2",
          clubName: "Second Club",
          clubSlug: "second-club",
          createdDate: "2026-07-12T12:00:00.000Z",
        },
      ],
    },
    {
      watchId: "watch-1",
      work,
      score: 9,
      watchedDate: "2026-01-01",
      createdDate: "2026-01-01T12:00:00.000Z",
      rewatch: false,
      text: "First watch — instant favourite.",
      clubReviews: [],
    },
  ];
}

describe("groupWorks", () => {
  it("collapses watches for one work, keeps the latest score, watches newest-first", () => {
    const works = groupWorks(twoWatchesForOneWork());
    expect(works).toHaveLength(1);
    expect(works[0].latestScore).toBe(7);
    expect(works[0].watches.map((watch) => watch.watchId)).toEqual([
      "watch-2",
      "watch-1",
    ]);
  });
});

describe("LibraryView", () => {
  afterEach(() => {
    route.query = {};
  });

  it("shows the gallery of works with each latest score", async () => {
    // Default meWatches mock: three works, one with a club review attached.
    render(LibraryView);

    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.getByText("Dune")).toBeInTheDocument();
    // The unrated Dune log renders a dash instead of a score.
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("narrows the gallery by the ?type= filter", async () => {
    route.query = { type: "movie" };
    render(LibraryView);

    // Movies stay; the book (Dune) is filtered out.
    expect(await screen.findByText("Inception")).toBeInTheDocument();
    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("opens a timeline of every watch with its club reviews nested", async () => {
    server.use(
      http.get("/api/me/watches", () =>
        HttpResponse.json(twoWatchesForOneWork()),
      ),
    );

    const { user } = render(LibraryView);

    // The card shows the latest score (7, not the older 9) and the log count.
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.getByText("2 logs")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "View history for Inception" }),
    );

    // The drawer's timeline lists both watches with their dates and scores
    // ("7" now appears twice: on the card and in the timeline).
    expect(await screen.findByText("2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getAllByText("7")).toHaveLength(2);
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByTitle("Rewatch")).toBeInTheDocument();
    expect(
      screen.getByText("First watch — instant favourite."),
    ).toBeInTheDocument();

    // The latest watch's club reviews nest under it — one canonical score for
    // the watch, so the sub-lines carry only the club chip + review date.
    expect(screen.getByText("Reviewed 2026-07-11")).toBeInTheDocument();
    expect(screen.getByText("Reviewed 2026-07-12")).toBeInTheDocument();
    expect(screen.getByText("Test Club")).toBeInTheDocument();
    expect(screen.getByText("Second Club")).toBeInTheDocument();

    // Every watch is editable; only the club-review-free one is deletable.
    expect(screen.getAllByLabelText("Edit log")).toHaveLength(2);
    expect(screen.getAllByLabelText("Delete log")).toHaveLength(1);
  });

  it("renders the work's rich metadata in the timeline drawer", async () => {
    const movieData: DetailedMovieData = {
      kind: "movie",
      actors: [
        { name: "Leonardo DiCaprio", character: "Cobb", profilePath: null },
      ],
      directors: [{ name: "Christopher Nolan", profilePath: null }],
      genres: ["Action", "Science Fiction"],
      production_companies: [],
      production_countries: [],
      overview: "A thief who steals corporate secrets through dream-sharing.",
      release_date: "2010-07-16",
      runtime: 148,
      imdb_id: "tt1375666",
      vote_average: 8.3,
    };

    server.use(
      http.get("/api/me/watches", () =>
        HttpResponse.json(twoWatchesForOneWork()),
      ),
      http.get("/api/me/watches/work-details", () =>
        HttpResponse.json(movieData),
      ),
    );

    const { user } = render(LibraryView);

    await user.click(
      await screen.findByRole("button", {
        name: "View history for Inception",
      }),
    );

    // Same rich sections as the club reviews drawer: synopsis, cast, TMDB
    // rating (shown plainly in the solo library — nothing to spoil), and the
    // external links.
    expect(await screen.findByText("Synopsis")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A thief who steals corporate secrets through dream-sharing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Leonardo DiCaprio")).toBeInTheDocument();
    expect(screen.getByText("TMDB rating")).toBeInTheDocument();
    expect(screen.getByText("8.3")).toBeInTheDocument();
    expect(screen.getByText("Letterboxd")).toBeInTheDocument();
    expect(screen.getByText("IMDb")).toBeInTheDocument();
  });
});
