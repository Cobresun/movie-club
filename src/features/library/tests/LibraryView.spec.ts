import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import LibraryView from "../views/LibraryView.vue";
import { groupWorks } from "../worksGrouping";

import { WorkType } from "@/../lib/types/generated/db";
import type { DiaryEntry } from "@/../lib/types/me";
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
      text: "First watch — instant favourite.",
      context: { kind: "solo" },
    },
  ];
}

describe("groupWorks", () => {
  it("collapses events for one work, keeps the latest score, entries newest-first", () => {
    const works = groupWorks(twoEventsForOneWork());
    expect(works).toHaveLength(1);
    expect(works[0].latestScore).toBe(7);
    expect(works[0].entries.map((entry) => entry.reviewId)).toEqual([
      "e2",
      "e1",
    ]);
  });
});

describe("LibraryView", () => {
  afterEach(() => {
    route.query = {};
  });

  it("shows the gallery of works with each latest score", async () => {
    // Default meReviews mock: three works across solo + club contexts.
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

  it("opens a timeline of every event for a clicked work", async () => {
    server.use(
      http.get("/api/me/reviews", () =>
        HttpResponse.json(twoEventsForOneWork()),
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

    // The drawer's timeline lists both events with their dates and scores
    // ("7" now appears twice: on the card and in the timeline).
    expect(await screen.findByText("2026-07-10")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getAllByText("7")).toHaveLength(2);
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByTitle("Rewatch")).toBeInTheDocument();
    expect(
      screen.getByText("First watch — instant favourite."),
    ).toBeInTheDocument();
    // Solo events are editable in place.
    expect(screen.getAllByLabelText("Edit event")).toHaveLength(2);
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
      http.get("/api/me/reviews", () =>
        HttpResponse.json(twoEventsForOneWork()),
      ),
      http.get("/api/me/reviews/work-details", () =>
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
