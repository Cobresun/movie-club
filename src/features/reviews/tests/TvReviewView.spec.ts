import { screen, within } from "@testing-library/vue";
import { http, HttpResponse } from "msw";

import ReviewView from "../views/ReviewView.vue";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

const SHOW_ID = "95396";

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

function episode(
  episodeNumber: number,
  title: string,
  entries: { memberId: string; score: number }[],
) {
  return {
    id: `e${episodeNumber}`,
    title,
    type: "tv",
    createdDate: "2026-03-04T00:00:00.000Z",
    externalId: `${SHOW_ID}:1:${episodeNumber}`,
    scores: scores(...entries),
    externalData: {
      kind: "tv",
      level: "episode",
      showId: SHOW_ID,
      showTitle: "Severance",
      seasonNumber: 1,
      episodeNumber,
      title,
      airDate: "2022-02-18T00:00:00.000Z",
      genres: ["Drama"],
      creators: ["Dan Erickson"],
      networks: ["Apple TV+"],
      castNames: [],
    },
  };
}

const show = {
  id: "show-1",
  title: "Severance",
  type: "tv",
  createdDate: "2026-02-01T00:00:00.000Z",
  externalId: SHOW_ID,
  scores: {},
  externalData: {
    kind: "tv",
    level: "show",
    showId: SHOW_ID,
    showTitle: "Severance",
    title: "Severance",
    genres: ["Drama"],
    creators: ["Dan Erickson"],
    networks: ["Apple TV+"],
    castNames: [],
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
    { memberId: "2", score: 10 },
  ]),
];

function useTvClub(reviews: unknown[] = tvReviews) {
  server.use(
    http.get("/api/club/:id", () =>
      HttpResponse.json({ clubId: 1, clubName: "Test club", type: "tv" }),
    ),
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(reviews)),
  );
}

describe("TV reviews", () => {
  it("shows one row per show, with its rolled-up score and coverage", async () => {
    useTvClub();
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByRole("heading", { name: "Severance" })).toBeInTheDocument();
    // Per member first: member 1 averages 6 over their two episodes, member 2
    // scored a single 10, so the club sits at 8.0 — not the 7.3 that averaging
    // all three review rows would give.
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("2/19 episodes")).toBeInTheDocument();
  });

  it("opens a show into its seasons, including one nobody has scored", async () => {
    useTvClub();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: /Severance/ }));

    expect(await screen.findByText("Season 1")).toBeInTheDocument();
    expect(screen.getByText("2/9 episodes")).toBeInTheDocument();
    // Season 2 is browsable before the club reaches it: its row comes from the
    // show's own season list, not from an episode existing as a work.
    expect(screen.getByText("Season 2")).toBeInTheDocument();
    expect(screen.getByText("0/10 episodes")).toBeInTheDocument();
  });

  it("opens a season into its scored episodes", async () => {
    useTvClub();
    const { user } = render(ReviewView, { props: { clubSlug: "1" } });

    await user.click(await screen.findByRole("button", { name: /Severance/ }));
    await user.click(await screen.findByRole("button", { name: /Season 1/ }));

    expect(await screen.findByText("Good News About Hell")).toBeInTheDocument();
    expect(screen.getByText("Half Loop")).toBeInTheDocument();
    expect(screen.getByText("S01E01")).toBeInTheDocument();
  });

  it("says how many of your own scores a season fill will replace", async () => {
    useTvClub();
    const { user, pinia } = render(ReviewView, { props: { clubSlug: "1" } });
    logIn(pinia);

    await user.click(await screen.findByRole("button", { name: /Severance/ }));
    const seasonOne = await screen.findByText("Season 1");
    const seasonRow = seasonOne.closest("div");
    await user.click(
      await within(seasonRow ?? document.body).findByRole("button", {
        name: "Score all episodes",
      }),
    );

    expect(
      await screen.findByText(/Writes your score to every one of the 9 episodes/),
    ).toBeInTheDocument();
    // The signed-in member is "2", who scored one of the two episodes by hand.
    expect(
      await screen.findByText(/This replaces 1 score you set individually/),
    ).toBeInTheDocument();
  });

  it("tells a club with no shows yet what to do", async () => {
    useTvClub([]);
    render(ReviewView, { props: { clubSlug: "1" } });

    expect(await screen.findByText(/No Reviews Yet/)).toBeInTheDocument();
    expect(screen.getByText(/episode collection/)).toBeInTheDocument();
  });
});
