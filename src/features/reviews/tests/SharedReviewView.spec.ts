import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { useRoute } from "vue-router";

import { type ClubPreview } from "../../../../lib/types/club";
import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import {
  type DetailedReviewListItem,
  type ReviewScores,
  type SharedReviewResponse,
} from "../../../../lib/types/lists";
import { type TvDataSummary } from "../../../../lib/types/tv";
import SharedReviewView from "../views/SharedReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

mockIntersectionObserver();

const sharedReview = {
  clubName: "Test Club",
  work: {
    title: "Inception",
    imageUrl: "https://test.com/poster.jpg",
    externalData: {
      kind: "movie",
      actors: [],
      directors: [],
      genres: [],
      production_companies: [],
      production_countries: [],
      tagline: "Your mind is the scene of the crime.",
    },
  },
  members: [{ id: "1", name: "dev", image: "https://test.com/dev.jpg" }],
  reviews: [{ user_id: "1", score: 9, created_date: "2024-05-01T00:00:00Z" }],
  comments: [],
};

describe("SharedReviewView", () => {
  it("renders the shared review's work and member", async () => {
    server.use(
      http.get("/api/club/:id/reviews/:workId/shared", () => HttpResponse.json(sharedReview)),
    );

    render(SharedReviewView);

    await expect(screen.findByRole("heading", { name: "Inception" })).resolves.toBeInTheDocument();
    expect(
      screen.getByText("Your mind is the scene of the crime.", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it("shows the error state when the shared review fails to load", async () => {
    server.use(
      http.get(
        "/api/club/:id/reviews/:workId/shared",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    render(SharedReviewView);

    await expect(screen.findByText("Failed to load review")).resolves.toBeInTheDocument();
  });

  it("invites a logged-out visitor to start their own club", async () => {
    server.use(
      http.get("/api/club/:id/reviews/:workId/shared", () => HttpResponse.json(sharedReview)),
    );
    render(SharedReviewView);

    expect(await screen.findByRole("link", { name: "Start your own club" })).toHaveAttribute(
      "href",
      "/newClub?utm_source=share&utm_medium=review&utm_campaign=start_club",
    );
  });
});

/** Matches the element that reads `text` in full, screen-reader-only words included. */
const readsAs = (text: string) => (_content: string, element: Element | null) =>
  element?.textContent === text;

describe("SharedReviewView for a TV show", () => {
  const SHOW_ID = "95396";

  const series: Omit<TvDataSummary, "level" | "title"> = {
    kind: "tv",
    showId: SHOW_ID,
    showTitle: "Severance",
    genres: ["Drama"],
    creators: ["Dan Erickson"],
    networks: ["Apple TV+"],
    castNames: [],
  };

  const members = [
    { id: "1", name: "Ana Lima" },
    { id: "2", name: "Ben Ito" },
  ];

  function scores(byMember: Record<string, number>): ReviewScores {
    const values = Object.values(byMember);
    const result: ReviewScores = {
      average: {
        id: "average",
        created_date: "2026-03-04T00:00:00.000Z",
        score: values.reduce((total, value) => total + value, 0) / values.length,
      },
    };
    for (const [memberId, score] of Object.entries(byMember)) {
      result[memberId] = { id: `r-${memberId}`, created_date: "2026-03-04T00:00:00.000Z", score };
    }
    return result;
  }

  function episode(
    episodeNumber: number,
    title: string,
    byMember: Record<string, number>,
  ): DetailedReviewListItem {
    return {
      id: `e${episodeNumber}`,
      parentId: "show-1",
      title,
      type: WorkType.TV,
      createdDate: "2026-03-04T00:00:00.000Z",
      externalId: `${SHOW_ID}:1:${episodeNumber}`,
      scores: scores(byMember),
      externalData: { ...series, level: "episode", seasonNumber: 1, episodeNumber, title },
    };
  }

  const showData: TvDataSummary = {
    ...series,
    level: "show",
    title: "Severance",
    numberOfSeasons: 2,
    seasons: [
      { seasonNumber: 1, name: "Season 1", episodeCount: 9 },
      { seasonNumber: 2, name: "Season 2", episodeCount: 10 },
    ],
  };

  const reviews: DetailedReviewListItem[] = [
    {
      id: "show-1",
      title: "Severance",
      type: WorkType.TV,
      createdDate: "2026-02-01T00:00:00.000Z",
      externalId: SHOW_ID,
      scores: {},
      externalData: showData,
    },
    episode(1, "Good News About Hell", { "1": 6 }),
    episode(2, "Half Loop", { "1": 6, "2": 10 }),
  ];

  const sharedShow: SharedReviewResponse = {
    clubName: "Severance Club",
    members,
    reviews: [],
    comments: [],
    work: {
      id: "show-1",
      type: WorkType.TV,
      title: "Severance",
      externalId: SHOW_ID,
      externalData: { ...showData, actors: [] },
    },
  };

  const tvClub: ClubPreview = {
    clubId: "1",
    clubName: "Severance Club",
    slug: "test-club",
    slugUpdatedAt: undefined,
    type: ClubType.TV,
  };

  beforeEach(() => {
    useRoute().params.workId = "show-1";
    server.use(
      http.get("/api/club/:id", () => HttpResponse.json<ClubPreview>(tvClub)),
      http.get("/api/club/:id/reviews/:workId/shared", () =>
        HttpResponse.json<SharedReviewResponse>(sharedShow),
      ),
      http.get("/api/club/:id/list/reviews", () =>
        HttpResponse.json<DetailedReviewListItem[]>(reviews),
      ),
    );
  });

  it("breaks the show down into the episodes the club scored", async () => {
    render(SharedReviewView);

    const breakdown = await screen.findByRole("region", { name: "Episode breakdown" });
    expect(within(breakdown).getByText("2/19 episodes scored")).toBeInTheDocument();

    const season = within(breakdown).getByRole("region", { name: "Season 1" });
    // Ana averages 6 over her two episodes and Ben 10 over his one.
    expect(within(season).getByText(readsAs("Season average 8.0"))).toBeInTheDocument();

    const episodes = within(within(season).getByRole("list", { name: "Season 1 episodes" }));
    expect(
      episodes.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toStrictEqual(["Episode 1: Good News About Hell", "Episode 2: Half Loop"]);
    expect(episodes.getByText(readsAs("Club average 6.0"))).toBeInTheDocument();
    expect(episodes.getByText(readsAs("Club average 8.0"))).toBeInTheDocument();
  });

  it("scores the show as the club sees it, averaging a member who scored only episodes", async () => {
    const [show, ...episodes] = reviews;
    if (show === undefined) throw new Error("No show in the fixture");
    server.use(
      http.get("/api/club/:id/list/reviews", () =>
        HttpResponse.json<DetailedReviewListItem[]>([
          { ...show, scores: scores({ "2": 9 }) },
          ...episodes,
        ]),
      ),
    );
    render(SharedReviewView);

    // Ben scored the show itself; Ana's 6 is her average over her episodes.
    expect(await screen.findByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("(2 ratings)")).toBeInTheDocument();
    expect(screen.getByText(readsAs("Averaged 6"))).toBeInTheDocument();
    expect(screen.getAllByText("Episode average")).toHaveLength(1);
    expect(screen.getByText(readsAs("9"))).toBeInTheDocument();
  });

  it("leaves out seasons nobody has scored", async () => {
    render(SharedReviewView);

    const breakdown = await screen.findByRole("region", { name: "Episode breakdown" });
    expect(within(breakdown).queryByRole("region", { name: "Season 2" })).not.toBeInTheDocument();
  });
});
