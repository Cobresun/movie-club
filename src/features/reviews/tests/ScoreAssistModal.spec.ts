import { screen, waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import type * as vueToastification from "vue-toastification";

import { ClubType, WorkType } from "../../../../lib/types/generated/db";
import { type DetailedReviewListItem, type Review } from "../../../../lib/types/lists";
import { type TvDataSummary } from "../../../../lib/types/tv";
import ScoreAssistModal from "../components/ScoreAssistModal.vue";
import { type ScoredCandidate } from "../composables/scoreAssistLogic";
import memberData from "@/mocks/data/member.json";
import { mockIntersectionObserver } from "@/mocks/IntersectionObserver";
import { server } from "@/mocks/server";
import { logIn, render } from "@/tests/utils";

mockIntersectionObserver();

// VTU stubs transitions process-wide in jsdom, so vue-toastification's
// transition-group container never renders toast content into the DOM;
// spy on useToast instead while keeping the plugin's default export intact.
const toastSuccess = vi.fn<(message: string) => void>();
vi.mock(import("vue-toastification"), async (importOriginal) => {
  const actual = await importOriginal<typeof vueToastification>();
  return {
    ...actual,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the stub only implements the success call the SUT uses; the real useToast surface is much larger
    useToast: (() => ({ success: toastSuccess }) as unknown) as typeof vueToastification.useToast,
  };
});

function makeTarget(scores: Record<string, Review> = {}): DetailedReviewListItem {
  return {
    id: "target",
    type: WorkType.MOVIE,
    title: "Target Movie",
    createdDate: "2024-01-01",
    scores,
  };
}

// Scores 1..5: the first pivot is Movie 4 (rank-middle window 2/3/4, closest
// to the initial 0-10 midpoint), per the deterministic selection rules.
const CURRENT_CLUB_ID = "club-1";
const candidates: ScoredCandidate[] = [1, 2, 3, 4, 5].map((n) => ({
  workId: `w${n}`,
  title: `Movie ${n}`,
  score: n,
  clubId: CURRENT_CLUB_ID,
  clubName: "Movie Night",
}));

describe("ScoreAssistModal", () => {
  it("asks the comparison question with the club-type noun", () => {
    render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.MOVIE },
    });
    expect(screen.getByText("Which movie did you like more?")).toBeInTheDocument();
    expect(screen.getByText("Tap the one you liked more")).toBeInTheDocument();
    expect(screen.getByText("Comparison 1 of up to 5")).toBeInTheDocument();
  });

  it("answers through the poster buttons, with no separate choice buttons", () => {
    render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.MOVIE },
    });
    expect(screen.getByRole("button", { name: "I liked Target Movie more" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I liked Movie 4 more" })).toBeInTheDocument();
    expect(screen.queryByText("This one")).not.toBeInTheDocument();
  });

  it("says which club a comparison came from when it isn't this one", () => {
    const fromElsewhere = candidates.map((candidate) =>
      candidate.workId === "w4"
        ? { ...candidate, clubId: "club-2", clubName: "Sunday Cinema" }
        : candidate,
    );
    render(ScoreAssistModal, {
      props: {
        target: makeTarget(),
        candidates: fromElsewhere,
        clubType: ClubType.MOVIE,
        currentClubId: CURRENT_CLUB_ID,
      },
    });
    expect(screen.getByText("from Sunday Cinema")).toBeInTheDocument();
  });

  it("leaves comparisons from this club unlabelled", () => {
    render(ScoreAssistModal, {
      props: {
        target: makeTarget(),
        candidates,
        clubType: ClubType.MOVIE,
        currentClubId: CURRENT_CLUB_ID,
      },
    });
    expect(screen.queryByText(/^from /)).not.toBeInTheDocument();
  });

  // Clubs can share a name, so the label is decided by club id.
  it("labels a comparison from another club that shares this club's name", () => {
    const sameName = candidates.map((candidate) =>
      candidate.workId === "w4" ? { ...candidate, clubId: "club-2" } : candidate,
    );
    render(ScoreAssistModal, {
      props: {
        target: makeTarget(),
        candidates: sameName,
        clubType: ClubType.MOVIE,
        currentClubId: CURRENT_CLUB_ID,
      },
    });
    expect(screen.getByText("from Movie Night")).toBeInTheDocument();
  });

  it("uses the book noun for book clubs", () => {
    render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.BOOK },
    });
    expect(screen.getByText("Which book did you like more?")).toBeInTheDocument();
  });

  it("shows episodes by their own stills, since they share their show's poster", () => {
    mockIntersectionObserver({ intersecting: true });
    const episode = (episodeNumber: number, title: string): TvDataSummary => ({
      kind: "tv",
      level: "episode",
      showId: "1",
      showTitle: "Nobody Wants This",
      seasonNumber: 3,
      episodeNumber,
      title,
      posterPath: "/show-poster.jpg",
      stillPath: `/still-${episodeNumber}.jpg`,
      genres: [],
      creators: [],
      networks: [],
      castNames: [],
    });
    const target: DetailedReviewListItem = {
      id: "target",
      type: WorkType.tv,
      title: "Heatwave",
      createdDate: "2024-01-01",
      scores: {},
      externalData: episode(1, "Heatwave"),
    };
    const episodes = [2, 3, 4, 5, 6].map((n, index) => ({
      workId: `e${n}`,
      title: `Episode ${n}`,
      score: index + 1,
      clubId: CURRENT_CLUB_ID,
      clubName: "TV Night",
      externalData: episode(n, `Episode ${n}`),
    }));

    render(ScoreAssistModal, {
      props: { target, candidates: episodes, clubType: ClubType.tv },
    });

    expect(screen.getByRole("img", { name: "Nobody Wants This: Heatwave" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w300/still-1.jpg",
    );
    expect(screen.getByRole("img", { name: "Nobody Wants This: Episode 5" })).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w300/still-5.jpg",
    );
  });

  it("prefills the entry panel with the converged suggestion, with a toast", async () => {
    let postedBody: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.MOVIE },
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    // Beat Movie 4, then Movie 5 (the top): aboveAll -> 5 + 0.5. The
    // suggestion lands in the dial, not the database — saving is the user's
    // call.
    await user.click(screen.getByRole("button", { name: "I liked Target Movie more" }));
    await user.click(screen.getByRole("button", { name: "I liked Target Movie more" }));

    expect(toastSuccess).toHaveBeenCalledWith("We picked 5.5/10");
    await expect(screen.findByRole("spinbutton", { name: "Score" })).resolves.toHaveValue(5.5);
    expect(postedBody).toBeUndefined();
    expect(rendered.emitted().close).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => {
      expect(postedBody).toStrictEqual({ workId: "target", score: 5.5 });
    });
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("prefills the pivot's score on 'too close to call'", async () => {
    let postedBody: unknown;
    server.use(
      http.post("/api/club/test-club/reviews", async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({});
      }),
    );

    const rendered = render(ScoreAssistModal, {
      props: { target: makeTarget(), candidates, clubType: ClubType.MOVIE },
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(screen.getByRole("button", { name: "Too close to call" }));

    await expect(screen.findByRole("spinbutton", { name: "Score" })).resolves.toHaveValue(4);
    expect(postedBody).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Save score" }));

    await waitFor(() => {
      expect(postedBody).toStrictEqual({ workId: "target", score: 4 });
    });
    expect(rendered.emitted().close).toHaveLength(1);
  });

  it("updates an existing review with PUT when the suggestion is saved", async () => {
    let putBody: unknown;
    server.use(
      http.put("/api/club/test-club/reviews/review-target", async ({ request }) => {
        putBody = await request.json();
        return HttpResponse.json({});
      }),
    );

    const target = makeTarget({
      [memberData.id]: {
        id: "review-target",
        created_date: "2024-01-01",
        score: 6,
      },
    });
    const rendered = render(ScoreAssistModal, {
      props: { target, candidates, clubType: ClubType.MOVIE },
    });
    const { user, pinia } = rendered;
    logIn(pinia);

    await user.click(screen.getByRole("button", { name: "Too close to call" }));
    await user.click(await screen.findByRole("button", { name: "Save score" }));

    await waitFor(() => {
      expect(putBody).toStrictEqual({ score: 4 });
    });
    expect(rendered.emitted().close).toHaveLength(1);
  });
});
