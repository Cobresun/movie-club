import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { type ClubPreview } from "../../../../lib/types/club";
import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import {
  type DetailedWorkListItem,
  type UserListItemWithSource,
} from "../../../../lib/types/lists";
import {
  type TMDBWatchProvider,
  type TMDBWatchProvidersResponse,
} from "../../../../lib/types/tmdb";
import WatchListView from "../views/WatchListView.vue";
import club from "@/mocks/data/club";
import watchlist from "@/mocks/data/watchlist";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

beforeEach(() => {
  server.use(
    http.get("/api/club/:id/nextWork", () => HttpResponse.json({ workId: null })),
    http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
      HttpResponse.json({ id: 502356, results: {} }),
    ),
  );
});

const service = (provider_id: number, provider_name: string): TMDBWatchProvider => ({
  provider_id,
  provider_name,
  logo_path: `/${provider_id}.jpg`,
  display_priority: provider_id,
});
const NETFLIX = service(8, "Netflix");
const MAX = service(1899, "Max");

/** Serves the given works as the club's one list. */
function serveList(clubType: ClubType, works: DetailedWorkListItem[]) {
  server.use(
    http.get("/api/club/:id", () => HttpResponse.json<ClubPreview>({ ...club, type: clubType })),
    http.get("/api/club/:id/list/all-items", () =>
      HttpResponse.json<UserListItemWithSource[]>(
        works.map((work) => ({ ...work, sourceListId: "1", sourceListTitle: "Watch List" })),
      ),
    ),
    http.get("/api/club/:id/list/1", () => HttpResponse.json<DetailedWorkListItem[]>(works)),
  );
}

/** Answers TMDB's watch-provider lookup for `media/id` with US subscription services. */
function serveStreaming(media: string, id: string, flatrate: TMDBWatchProvider[]) {
  server.use(
    http.get(`https://api.themoviedb.org/3/${media}/${id}/watch/providers`, () =>
      HttpResponse.json<TMDBWatchProvidersResponse>({
        id: Number(id),
        results: { US: { link: `https://www.themoviedb.org/${media}/${id}/watch`, flatrate } },
      }),
    ),
  );
}

function movie(externalId: string, title: string): DetailedWorkListItem {
  const [base] = watchlist;
  if (base === undefined) throw new Error("The watchlist fixture has no movie");
  return { ...base, id: `work-${externalId}`, externalId, title };
}

function show(showId: string, title: string): DetailedWorkListItem {
  return {
    id: `work-${showId}`,
    type: WorkType.TV,
    title,
    createdDate: "2026-01-01T00:00:00.000Z",
    externalId: showId,
    externalData: {
      kind: "tv",
      level: "show",
      showId,
      showTitle: title,
      title,
      genres: ["Drama"],
      creators: [],
      networks: [],
      castNames: [],
    },
  };
}

describe("WatchListView", () => {
  it("renders each list with its title and item count", async () => {
    render(WatchListView);

    // Baseline /list handler returns one list, "Watch List" with itemCount 1.
    expect(await screen.findByRole("heading", { name: "Watch List" })).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("opens the manage-lists modal", async () => {
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Manage" }));

    expect(await screen.findByText("Manage Lists")).toBeInTheDocument();
  });

  it("shows the empty state when the club has no lists", async () => {
    server.use(http.get("/api/club/:id/list", () => HttpResponse.json([])));

    render(WatchListView);

    expect(await screen.findByText("No lists yet")).toBeInTheDocument();
  });

  it("opens an item's details when its poster is clicked", async () => {
    const title = "The Super Mario Bros. Movie";
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: title }));

    // The panel carries the per-item actions and the added-on line that only
    // it offers; the title is already on the card behind it.
    expect(await screen.findByRole("button", { name: "Up next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove from list" })).toBeInTheDocument();
    expect(screen.getByText(/^Added /)).toBeInTheDocument();
  });

  it("filters the lists by what the movies are, not by review scores", async () => {
    server.use(
      http.get("/api/club/:id/list/all-items", () =>
        HttpResponse.json(
          watchlist.map((item) => ({
            ...item,
            // The shared fixture predates the summary shape list payloads carry.
            externalData: {
              ...item.externalData,
              kind: "movie",
              genres: ["Comedy"],
              directors: [],
              castNames: [],
              production_companies: [],
            },
            sourceListId: "1",
            sourceListTitle: "Watch List",
          })),
        ),
      ),
    );
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const panel = within(await screen.findByRole("dialog"));

    expect(panel.getByRole("heading", { name: "Genre" })).toBeInTheDocument();
    expect(panel.queryByRole("heading", { name: "Club score" })).not.toBeInTheDocument();
    expect(panel.queryByRole("heading", { name: "Reviewed in" })).not.toBeInTheDocument();
  });

  it("filters a movie club's lists by the services the viewer can stream on", async () => {
    serveList(ClubType.MOVIE, [movie("1", "Heat"), movie("2", "Ronin")]);
    serveStreaming("movie", "1", [NETFLIX]);
    serveStreaming("movie", "2", [NETFLIX, MAX]);
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const panel = within(await screen.findByRole("dialog"));

    expect(await panel.findByRole("heading", { name: "Streaming on" })).toBeInTheDocument();
    expect(await panel.findByRole("button", { name: "Netflix 2" })).toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Max 1" }));
    await user.click(panel.getByRole("button", { name: "Show 1 movie" }));

    expect(screen.getByRole("button", { name: "Remove Streaming on: Max" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ronin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Heat" })).not.toBeInTheDocument();
  });

  it("filters a TV club's lists by where each show streams", async () => {
    serveList(ClubType.TV, [show("95396", "Severance"), show("1399", "Game of Thrones")]);
    serveStreaming("tv", "95396", [service(350, "Apple TV Plus")]);
    serveStreaming("tv", "1399", [MAX]);
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const panel = within(await screen.findByRole("dialog"));
    await user.click(await panel.findByRole("button", { name: "Apple TV Plus 1" }));
    await user.click(panel.getByRole("button", { name: "Close filters" }));

    expect(screen.getByRole("button", { name: "Severance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Game of Thrones" })).not.toBeInTheDocument();
  });

  it("offers no streaming filter in a book club", async () => {
    server.use(
      http.get("/api/club/:id", () =>
        HttpResponse.json<ClubPreview>({ ...club, type: ClubType.BOOK }),
      ),
      http.get("/api/club/:id/list/all-items", () =>
        HttpResponse.json<UserListItemWithSource[]>([
          {
            id: "dune",
            type: WorkType.BOOK,
            title: "Dune",
            createdDate: "2026-01-01T00:00:00.000Z",
            externalId: "B1C2D3",
            externalData: { kind: "book", title: "Dune", authors: ["Frank Herbert"], subjects: [] },
            sourceListId: "1",
            sourceListTitle: "Reading List",
          },
        ]),
      ),
    );
    const { user } = render(WatchListView);

    await user.click(await screen.findByRole("button", { name: "Filters" }));
    const panel = within(await screen.findByRole("dialog"));

    expect(panel.getByRole("heading", { name: "Author" })).toBeInTheDocument();
    expect(panel.queryByRole("heading", { name: "Streaming on" })).not.toBeInTheDocument();
  });
});
