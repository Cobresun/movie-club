import { screen, waitFor } from "@testing-library/vue";
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

function tmdbEpisode(seasonNumber: number, episodeNumber: number, name: string, airDate: string) {
  return {
    episode_number: episodeNumber,
    season_number: seasonNumber,
    name,
    still_path: null,
    air_date: airDate,
  } satisfies TMDBTvEpisodeData;
}

const tmdbSeasons = {
  1: [
    tmdbEpisode(1, 1, "Good News About Hell", "2022-02-18"),
    tmdbEpisode(1, 2, "Half Loop", "2022-02-18"),
    tmdbEpisode(1, 3, "In Perpetuity", "2022-02-25"),
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

  it("scores an episode nobody has scored yet", async () => {
    const { user } = await openSeverance();

    await user.click(await screen.findByRole("button", { name: "Score In Perpetuity" }));
    await user.type(await screen.findByRole("spinbutton", { name: "Score" }), "7.5");
    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Score In Perpetuity" })).not.toBeInTheDocument(),
    );
    // Your score, and the episode average that one score makes.
    expect(await screen.findAllByText("7.5")).toHaveLength(2);
    expect(await screen.findByText("3/9 episodes")).toBeInTheDocument();
  });

  it("lists a later season's upcoming episodes without offering to score them", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: /^Season 2/ }));

    expect(await screen.findByRole("heading", { name: "Not Out Yet" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score Not Out Yet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Hello, Ms. Cobel" })).toBeInTheDocument();
  });

  it("says how many of your own scores a season fill will replace", async () => {
    const { user } = await openSeverance();

    await user.click(screen.getByRole("button", { name: "Score all episodes" }));

    expect(
      await screen.findByText(/Writes your score to every one of the 9 episodes/),
    ).toBeInTheDocument();
    // The signed-in member scored one of the two episodes by hand.
    expect(
      await screen.findByText(/This replaces 1 score you set individually/),
    ).toBeInTheDocument();
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
