import { UserEvent } from "@testing-library/user-event";
import { screen, within } from "@testing-library/vue";
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

/** Renders the club signed in; Severance, its latest show, opens on season 1. */
async function renderSeverance(reviews: DetailedReviewListItem[] = tvReviews) {
  useTvClub(reviews);
  const rendered = render(ReviewView, { props: { clubSlug: CLUB_SLUG } });
  logIn(rendered.pinia);
  await screen.findByRole("heading", { name: "In Perpetuity", level: 4 });
  return rendered;
}

async function saveScore(user: UserEvent, value: string) {
  await user.type(await screen.findByRole("spinbutton", { name: "Score" }), value);
  await user.click(screen.getByRole("button", { name: "Save score" }));
}

describe("TV reviews", () => {
  it("lists each show with its rolled-up score and coverage", async () => {
    await renderSeverance();

    expect(screen.getByRole("heading", { name: /^Severance/, level: 2 })).toBeInTheDocument();
    // Per member first: member 1 averages 6 over their two episodes, member 2
    // scored a single 10, so the club sits at 8 — not the 7.33 that averaging
    // all three review rows would give.
    expect(screen.getByRole("button", { name: "Severance, average 8.0" })).toBeInTheDocument();
    expect(screen.getByText("2/19 episodes")).toBeInTheDocument();
  });

  it("opens on the season the club is in, listing every episode scored or not", async () => {
    await renderSeverance();

    expect(screen.getByRole("heading", { name: "Good News About Hell" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Half Loop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Season 1/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Season 2/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("2/9 episodes")).toBeInTheDocument();
  });

  it("offers to score only the aired episodes you have not scored", async () => {
    await renderSeverance();

    expect(screen.getByRole("button", { name: "Score In Perpetuity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Good News About Hell" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score Half Loop" })).not.toBeInTheDocument();
  });

  it("opens an episode in place, keeping others' scores hidden until you reveal them", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Good News About Hell" }));

    expect(screen.getByRole("button", { name: "Good News About Hell" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(/stay hidden until you score this episode/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reveal scores" }));

    expect(screen.queryByText(/stay hidden until you score this episode/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reveal scores" })).not.toBeInTheDocument();
  });

  it("scores an episode nobody has scored yet from its row", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Score In Perpetuity" }));
    await saveScore(user, "7.5");

    // Now on the reviews list, the episode's score is yours to edit.
    expect(await screen.findByRole("button", { name: "Edit your score" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score In Perpetuity" })).not.toBeInTheDocument();
    expect(screen.getByText("3/9 episodes")).toBeInTheDocument();
  });

  it("opens a scored episode onto its details", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Half Loop" }));
    await user.click(screen.getByRole("button", { name: "episode details" }));

    expect(
      await screen.findByRole("heading", { name: /^Half Loop/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit score/i })).toBeInTheDocument();
  });

  it("opens an episode nobody has scored onto its details", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "In Perpetuity" }));
    await user.click(screen.getByRole("button", { name: "episode details" }));

    expect(
      await screen.findByRole("heading", { name: /^In Perpetuity/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/field trip to the Perpetuity Wing/)).toBeInTheDocument();
    expect(screen.getByText(/No scores yet/)).toBeInTheDocument();
    // There is no work to delete until someone scores it.
    expect(screen.queryByRole("button", { name: "Delete review" })).not.toBeInTheDocument();
  });

  it("lists a later season's upcoming episodes without offering to score them", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: /^Season 2/ }));

    expect(await screen.findByRole("heading", { name: "Not Out Yet" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Score Not Out Yet" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score Hello, Ms. Cobel" })).toBeInTheDocument();
  });

  it("scores a season on its own, leaving the episode scores beneath it as they were", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Score season" }));
    await saveScore(user, "4");

    // Now on the reviews list, the season's score is yours to edit.
    expect(await screen.findByRole("button", { name: "Edit your score" })).toBeInTheDocument();
    // Your 4 replaces the 10 your episodes averaged; member 1 set no season
    // score, so theirs is still their episodes' 6.
    expect(screen.getByRole("button", { name: "Season 1, average 5.0" })).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("2/9 episodes")).toBeInTheDocument();
  });

  it("never shows a season score as the show's own while it saves", async () => {
    const { user } = await renderSeverance();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/club/:id/reviews", async () => {
        await held;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await user.click(screen.getByRole("button", { name: "Score season" }));
    await saveScore(user, "4");

    const showScore = within(screen.getByRole("group", { name: "Show score" }));
    expect(showScore.getByText("Yours is averaged from your seasons: 10.0")).toBeInTheDocument();
    expect(showScore.queryByText(/You scored it/)).not.toBeInTheDocument();
    release();
  });

  it("keeps a whole show when the search matches one of its episodes", async () => {
    const { user } = await renderSeverance();

    await user.type(screen.getByRole("textbox"), "Half Loop");

    expect(
      await screen.findByRole("button", { name: "Severance, average 8.0" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Half Loop" })).toBeInTheDocument();
  });

  it("keeps a show when a filter only its episodes carry matches", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Season" }));
    await user.type(await screen.findByPlaceholderText("Enter a season number"), "1");
    await user.click(screen.getByRole("button", { name: "=" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("button", { name: /^Season\W*1$/ })).toBeInTheDocument();

    expect(
      await screen.findByRole("button", { name: "Severance, average 8.0" }),
    ).toBeInTheDocument();
  });

  it("scores the show on its own, leaving its seasons as they were", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: "Score show" }));
    await saveScore(user, "7");

    expect(await screen.findByRole("button", { name: "Edit your score" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Season 1, average 8.0" })).toBeInTheDocument();
  });

  it("marks a show score averaged from a member's episodes apart from one they set", async () => {
    await renderSeverance([
      { ...show, scores: scores({ memberId: "1", score: 9 }) },
      ...tvReviews.slice(1),
    ]);

    // Member 1 set 9 on the show itself, which wins over their episodes' 6;
    // member 2 set nothing there, so theirs is their one episode's 10.
    const showScore = within(screen.getByRole("group", { name: "Show score" }));
    expect(showScore.getByText("9.5")).toBeInTheDocument();
    expect(showScore.getAllByText("Averaged")).toHaveLength(1);
  });

  it("collapses a show and expands every show and season at once", async () => {
    const { user } = await renderSeverance();

    await user.click(screen.getByRole("button", { name: /^Severance/ }));

    expect(screen.getByRole("button", { name: /^Severance/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("heading", { name: "In Perpetuity" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand all" }));

    expect(await screen.findByRole("heading", { name: "Not Out Yet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "In Perpetuity" })).toBeInTheDocument();
  });

  it("tells a club with no shows yet what to do", async () => {
    useTvClub([]);
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByText(/No Reviews Yet/)).toBeInTheDocument();
    expect(screen.getByText(/episode collection/)).toBeInTheDocument();
  });
});
