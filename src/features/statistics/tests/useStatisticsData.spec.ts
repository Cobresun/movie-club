import { waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import { ensure, isDefined } from "../../../../lib/checks/checks";
import { useStatisticsData } from "../composables/useStatisticsData";
import { isMovieStats, type WorkStatsData } from "../types";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

const members = [
  { id: "1", email: "dev@email.com", name: "dev" },
  { id: "2", email: "user@email.com", name: "user" },
];

function score(id: string, value: number) {
  return { id, created_date: "2024-05-01T00:00:00.000Z", score: value };
}

/** A reviews-list row as the API serves it, with summary movie metadata. */
function movieReview(overrides: Record<string, unknown> = {}) {
  return {
    id: "work-movie",
    title: "Inception",
    type: "movie",
    createdDate: "2024-05-01T00:00:00.000Z",
    externalId: "27205",
    scores: { "1": score("r1", 8), "2": score("r2", 6), average: score("average", 7) },
    externalData: {
      kind: "movie",
      castNames: [],
      directors: [],
      genres: ["Science Fiction"],
      production_companies: ["Warner Bros."],
      production_countries: ["United States of America"],
    },
    ...overrides,
  };
}

function bookReview(overrides: Record<string, unknown> = {}) {
  return {
    id: "work-book",
    title: "Dune",
    type: "book",
    createdDate: "2024-06-01T00:00:00.000Z",
    externalId: "olid-1",
    scores: { "1": score("r3", 9), average: score("average", 9) },
    ...overrides,
  };
}

/** Renders the composable and exposes its result for assertions. */
async function renderStats(reviews: unknown[], memberList = members) {
  server.use(
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(reviews)),
    http.get("/api/club/:id/members", () => HttpResponse.json(memberList)),
  );

  const captured: { value?: ReturnType<typeof useStatisticsData> } = {};
  const Harness = defineComponent({
    setup() {
      captured.value = useStatisticsData();
      return () => null;
    },
  });
  render(Harness);

  await waitFor(() => {
    expect(captured.value?.loading.value).toBe(false);
  });
  return ensure(captured.value);
}

describe("useStatisticsData", () => {
  it("reports no reviews for an empty club", async () => {
    const stats = await renderStats([]);

    expect(stats.hasReviews.value).toBe(false);
    expect(stats.workData.value).toEqual([]);
    expect(stats.histogramData.value).toEqual([]);
  });

  it("carries a movie's genres and metadata onto its stats row", async () => {
    const stats = await renderStats([movieReview()]);

    const [work] = stats.workData.value;
    expect(work?.title).toBe("Inception");
    expect(isDefined(work) && isMovieStats(work)).toBe(true);
    expect(isDefined(work) && isMovieStats(work) ? work.genres : []).toEqual(["Science Fiction"]);
    expect(work?.average).toBe(7);
  });

  it("keeps a book with no external metadata — book stats are score-only", async () => {
    const stats = await renderStats([bookReview({ externalData: undefined })]);

    expect(stats.workData.value.map((w: WorkStatsData) => w.title)).toEqual(["Dune"]);
  });

  it("drops a movie with no external metadata, which movie stats depend on", async () => {
    const stats = await renderStats([movieReview({ externalData: undefined }), bookReview()]);

    expect(stats.workData.value.map((w: WorkStatsData) => w.title)).toEqual(["Dune"]);
  });

  it("drops works nobody has scored", async () => {
    const stats = await renderStats([movieReview({ scores: {} })]);

    expect(stats.hasReviews.value).toBe(false);
  });

  it("excludes the synthetic average from per-member scores", async () => {
    const stats = await renderStats([movieReview()]);

    expect(stats.workData.value[0]?.userScores).toEqual({ "1": 8, "2": 6 });
  });

  it("builds an 11-bin histogram counting each member's scores by whole number", async () => {
    const stats = await renderStats([
      movieReview(),
      bookReview({ scores: { "1": score("r3", 8.4), average: score("average", 8.4) } }),
    ]);

    const histogram = stats.histogramData.value;
    expect(histogram).toHaveLength(11);
    expect(histogram.map((bin) => bin.bin)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // dev scored 8 and 8.4 — both floor into bin 8.
    expect(histogram[8]?.["1"]).toBe(2);
    // user scored only the movie, a 6.
    expect(histogram[6]?.["2"]).toBe(1);
    expect(histogram[8]?.["2"]).toBe(0);
  });

  it("exposes the club's members alongside the work data", async () => {
    const stats = await renderStats([movieReview()]);

    expect(stats.members.value.map((m) => m.name)).toEqual(["dev", "user"]);
  });
});
