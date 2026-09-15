import { screen } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import { WorkType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { TMDBTvEpisodeData } from "../../../../lib/types/tv";
import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { tvReviewsApi } from "@/mocks/tvReviews";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

const SHOW_ID = "95396";

/** The signed-in member in `logIn`. */
const SIGNED_IN = "2";

function score(memberId: string, value: number) {
  return {
    [memberId]: { id: `r-${memberId}`, created_date: "2026-03-04T00:00:00.000Z", score: value },
  };
}

function scores(...entries: { memberId: string; score: number }[]) {
  const average = entries.reduce((total, entry) => total + entry.score, 0) / entries.length;
  return {
    ...Object.assign({}, ...entries.map((entry) => score(entry.memberId, entry.score))),
    average: { id: "average", created_date: "2026-03-04T00:00:00.000Z", score: average },
  };
}

const seriesFields = {
  kind: "tv" as const,
  showId: SHOW_ID,
  showTitle: "Severance",
  genres: ["Drama"],
  creators: ["Dan Erickson"],
  networks: ["Apple TV+"],
  castNames: [],
};

function episode(
  episodeNumber: number,
  title: string,
  entries: { memberId: string; score: number }[],
): DetailedReviewListItem {
  return {
    id: `e${episodeNumber}`,
    title,
    type: WorkType.tv,
    createdDate: "2026-03-04T00:00:00.000Z",
    externalId: `${SHOW_ID}:1:${episodeNumber}`,
    scores: scores(...entries),
    externalData: {
      ...seriesFields,
      level: "episode",
      seasonNumber: 1,
      episodeNumber,
      title,
    },
  };
}

const show: DetailedReviewListItem = {
  id: "show-1",
  title: "Severance",
  type: WorkType.tv,
  createdDate: "2026-02-01T00:00:00.000Z",
  externalId: SHOW_ID,
  imageUrl: "https://image.tmdb.org/t/p/w154/severance.jpg",
  scores: {},
  externalData: {
    ...seriesFields,
    level: "show",
    title: "Severance",
    numberOfSeasons: 2,
    numberOfEpisodes: 19,
    seasons: [
      { seasonNumber: 1, name: "Season 1", episodeCount: 9 },
      { seasonNumber: 2, name: "Season 2", episodeCount: 10 },
    ],
  },
};

/**
 * Member "1" scored two episodes, member "2" only the second — the case where
 * averaging every review row and averaging each member's own episodes disagree.
 */
const tvReviews = [
  show,
  episode(1, "Good News About Hell", [{ memberId: "1", score: 6 }]),
  episode(2, "Half Loop", [
    { memberId: "1", score: 6 },
    { memberId: SIGNED_IN, score: 10 },
  ]),
];

function tmdbEpisode(
  seasonNumber: number,
  episodeNumber: number,
  name: string,
  airDate: string,
  overview?: string,
) {
  return {
    episode_number: episodeNumber,
    season_number: seasonNumber,
    name,
    overview,
    still_path: null,
    air_date: airDate,
  } satisfies TMDBTvEpisodeData;
}

const tmdbSeasons = {
  1: [
    tmdbEpisode(1, 1, "Good News About Hell", "2022-02-18"),
    tmdbEpisode(1, 2, "Half Loop", "2022-02-18"),
    tmdbEpisode(
      1,
      3,
      "In Perpetuity",
      "2022-02-25",
      "Mark and his team take a field trip to the Perpetuity Wing.",
    ),
  ],
  2: [
    tmdbEpisode(2, 1, "Hello, Ms. Cobel", "2025-01-17"),
    tmdbEpisode(2, 2, "Not Out Yet", "2999-01-01"),
  ],
};

function useTvClub(reviews: DetailedReviewListItem[] = tvReviews) {
  server.use(
    http.get("/api/club/:id", () =>
      HttpResponse.json({ clubId: 1, clubName: "Test club", type: "tv" }),
    ),
    ...tvReviewsApi({ reviews, userId: SIGNED_IN, seasons: tmdbSeasons }),
  );
}

/** The club slug the mocked route carries, which score saves refetch under. */
const CLUB_SLUG = "test-club";

async function openSeverance() {
  useTvClub();
  const rendered = render(ReviewView, { props: { clubSlug: CLUB_SLUG } });
  logIn(rendered.pinia);
  await rendered.user.click(await screen.findByRole("button", { name: "Severance" }));
  await screen.findByRole("heading", { name: "Severance", level: 2 });
  return rendered;
}

describe("TV reviews", () => {
  it("shows each show as a poster card with its rolled-up score and coverage", async () => {
    useTvClub();
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByRole("heading", { name: "Severance" })).toBeInTheDocument();
    // Per member first: member 1 averages 6 over their two episodes, member 2
    // scored a single 10, so the club sits at 8 — not the 7.33 that averaging
    // all three review rows would give.
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("2/19 episodes")).toBeInTheDocument();
  });

  it("opens a show onto every episode of its season, scored or not", async () => {
    await openSeverance();

    expect(await screen.findByRole("heading", { name: "In Perpetuity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Good News About Hell" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Half Loop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Season 1/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("2/9 episodes")).toBeInTheDocument();
  });

  it("offers to score only the aired episodes you have not scored", async () => {
    await openSeverance();

    await screen.findByRole("heading", { name: "In Perpetuity" });
    expect(screen.getByRole("button", { name: "Score In Perpetuity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Good News About Hell" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score Half Loop" })).not.toBeInTheDocument();
  });

  it("opens a scored episode onto its details", async () => {
    const { user } = await openSeverance();

    await user.click(await screen.findByRole("button", { name: "Half Loop" }));

    expect(
      await screen.findByRole("heading", { name: /^Half Loop/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit score/i })).toBeInTheDocument();
  });

  it("opens an episode nobody has scored onto its details", async () => {
    const { user } = await openSeverance();

    await user.click(await screen.findByRole("button", { name: "In Perpetuity" }));

    expect(
      await screen.findByRole("heading", { name: /^In Perpetuity/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/field trip to the Perpetuity Wing/)).toBeInTheDocument();
    expect(screen.getByText(/No scores yet/)).toBeInTheDocument();
    // There is no work to delete until someone scores it.
    expect(screen.queryByRole("button", { name: "Delete review" })).not.toBeInTheDocument();
  });

  it("scores an episode nobody has scored yet from its details", async () => {
    const { user } = await openSeverance();

    await user.click(await screen.findByRole("button", { name: "Score In Perpetuity" }));
    await user.click(await screen.findByRole("button", { name: "Rate this episode" }));
    await user.type(await screen.findByRole("spinbutton", { name: "Score" }), "7.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    // Now on the reviews list, the episode opens as itself.
    expect(await screen.findByRole("button", { name: /edit score/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score In Perpetuity" })).not.toBeInTheDocument();
    expect(screen.getByText("3/9 episodes")).toBeInTheDocument();
  });

  it("lists a later season's upcoming episodes without offering to score them", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: /^Season 2/ }));

    expect(await screen.findByRole("heading", { name: "Not Out Yet" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score Not Out Yet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Hello, Ms. Cobel" })).toBeInTheDocument();
  });

  it("scores a season on its own, leaving the episode scores beneath it as they were", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: "Score season" }));
    expect(await screen.findByText(/Everything that happens in season 1/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Rate this season" }));
    await user.type(await screen.findByRole("spinbutton", { name: "Score" }), "4");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    // Now on the reviews list, the season opens as itself.
    expect(await screen.findByRole("button", { name: /edit score/i })).toBeInTheDocument();
    // Your 4 replaces the 10 your episodes averaged; member 1 set no season
    // score, so theirs is still their episodes' 6.
    expect(
      await screen.findByRole("button", { name: "Season 1, average 5.0" }),
    ).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("2/9 episodes")).toBeInTheDocument();
  });

  it("scores the show on its own, leaving its seasons as they were", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: "Score show" }));
    await user.click(await screen.findByRole("button", { name: "Rate this show" }));
    await user.type(await screen.findByRole("spinbutton", { name: "Score" }), "7");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    expect(await screen.findByRole("button", { name: /edit score/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Season 1, average 8.0" })).toBeInTheDocument();
  });

  it("marks a show score averaged from a member's episodes apart from one they set", async () => {
    useTvClub([{ ...show, scores: scores({ memberId: "1", score: 9 }) }, ...tvReviews.slice(1)]);
    render(ReviewView, { props: { clubSlug: "1" } });

    // Member 1 set 9 on the show itself, which wins over their episodes' 6;
    // member 2 set nothing there, so theirs is their one episode's 10.
    expect(await screen.findByText("9.5")).toBeInTheDocument();
    expect(screen.getAllByText("Averaged")).toHaveLength(1);
  });

  it("goes back to every show", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: "All shows" }));

    expect(await screen.findByText("2/19 episodes")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Severance", level: 2 })).not.toBeInTheDocument();
  });

  it("tells a club with no shows yet what to do", async () => {
    useTvClub([]);
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByText(/No Reviews Yet/)).toBeInTheDocument();
    expect(screen.getByText(/episode collection/)).toBeInTheDocument();
  });
});
