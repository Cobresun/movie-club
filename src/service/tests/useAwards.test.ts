import { http, HttpResponse } from "msw";
import { ref } from "vue";

import { AwardsStep } from "../../../lib/types/awards";
import { WorkType } from "../../../lib/types/generated/db";
import {
  useAddCategory,
  useAddNomination,
  useAwards,
  useDeleteCategory,
  useDeleteNomination,
  useSubmitRanking,
  useUpdateStep,
} from "../useAwards";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

interface FakeNomination {
  movieId: number;
  movieTitle: string;
  nominatedBy: string[];
  ranking: Record<string, number>;
}

interface FakeAward {
  title: string;
  nominations: FakeNomination[];
}

/**
 * A fake awards year that keeps what the mutations send it, so each one is
 * checked by reading the year back the way a client does.
 */
function awardsApi(initial: { step?: AwardsStep; awards?: FakeAward[] } = {}) {
  const year = {
    year: "2024",
    step: initial.step ?? AwardsStep.Nominations,
    awards: initial.awards ?? [],
  };
  const base = "/api/club/:id/awards/:year";
  const award = (title: unknown) => year.awards.find((entry) => entry.title === String(title));
  const ok = () => new HttpResponse(null, { status: 200 });

  return [
    http.get(base, () => HttpResponse.json(year)),
    http.put(`${base}/step`, async ({ request }) => {
      ({ step: year.step } = (await request.json()) as { step: AwardsStep });
      return ok();
    }),
    http.post(`${base}/category`, async ({ request }) => {
      const { title } = (await request.json()) as { title: string };
      year.awards.push({ title, nominations: [] });
      return ok();
    }),
    http.delete(`${base}/category/:title`, ({ params }) => {
      const title = decodeURIComponent(String(params.title));
      year.awards = year.awards.filter((entry) => entry.title !== title);
      return ok();
    }),
    http.post(`${base}/nomination`, async ({ request }) => {
      const { awardTitle, movieId, nominatedBy } = (await request.json()) as {
        awardTitle: string;
        movieId: number;
        nominatedBy?: string;
      };
      award(awardTitle)?.nominations.push({
        movieId,
        movieTitle: `Movie ${movieId}`,
        nominatedBy: nominatedBy === undefined ? [] : [nominatedBy],
        ranking: {},
      });
      return ok();
    }),
    http.delete(`${base}/nomination/:movieId`, ({ params }) => {
      for (const entry of year.awards) {
        entry.nominations = entry.nominations.filter(
          (nomination) => String(nomination.movieId) !== String(params.movieId),
        );
      }
      return ok();
    }),
    http.post(`${base}/ranking`, async ({ request }) => {
      const { awardTitle, voter, movies } = (await request.json()) as {
        awardTitle: string;
        voter?: string;
        movies: number[];
      };
      movies.forEach((movieId, index) => {
        const nomination = award(awardTitle)?.nominations.find(
          (candidate) => candidate.movieId === movieId,
        );
        if (nomination) nomination.ranking[voter ?? "anonymous"] = index + 1;
      });
      return ok();
    }),
  ];
}

/** Runs the year query alongside the mutation under test. */
function withYear<T>(mutation: () => T) {
  return () => ({ year: useAwards(ref("test-club"), ref("2024")), mutation: mutation() });
}

/** The year's categories as `title:movieId+movieId`. */
function categories(year: ReturnType<typeof useAwards>) {
  return year.data.value?.awards.map(
    (award) => `${award.title}:${award.nominations.map((n) => n.movieId).join("+")}`,
  );
}

/** A nomination with no rankings yet. */
function nomination(movieId: number): FakeNomination {
  return { movieId, movieTitle: `Movie ${movieId}`, nominatedBy: [], ranking: {} };
}

// ---------------------------------------------------------------------------
// useAwards
// ---------------------------------------------------------------------------

describe("useAwards", () => {
  it("swaps to the other year when the year ref changes", async () => {
    server.use(
      http.get("/api/club/:id/awards/:year", ({ params }) =>
        HttpResponse.json({ year: params.year, step: "nominations", awards: [] }),
      ),
    );

    const year = ref("2023");
    const { result } = withSetup(() => useAwards(ref("test-club"), year));

    await vi.waitFor(() => {
      expect(result.data.value?.year).toBe("2023");
    });

    year.value = "2024";

    await vi.waitFor(() => {
      expect(result.data.value?.year).toBe("2024");
    });
  });
});

// ---------------------------------------------------------------------------
// useUpdateStep
// ---------------------------------------------------------------------------

describe("useUpdateStep", () => {
  it("moves the year to the given step", async () => {
    server.use(...awardsApi({ step: AwardsStep.Nominations }));

    const { result } = withSetup(withYear(() => useUpdateStep(ref("test-club"), ref("2024"))));

    await vi.waitFor(() => {
      expect(result.year.data.value?.step).toBe(AwardsStep.Nominations);
    });

    result.mutation.mutate(AwardsStep.Ratings);

    await vi.waitFor(() => {
      expect(result.year.data.value?.step).toBe(AwardsStep.Ratings);
    });
  });
});

// ---------------------------------------------------------------------------
// useAddCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useAddCategory", () => {
  it("adds the category to the year", async () => {
    server.use(...awardsApi());

    const { result } = withSetup(withYear(() => useAddCategory("test-club", "2024")));

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual([]);
    });

    result.mutation.mutate("Best Picture");

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeleteCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteCategory", () => {
  it("removes a category whose title needs escaping in the url", async () => {
    server.use(...awardsApi({ awards: [{ title: "Best Picture", nominations: [] }] }));

    const { result } = withSetup(withYear(() => useDeleteCategory("test-club", "2024")));

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:"]);
    });

    result.mutation.mutate({ title: "Best Picture", nominations: [] });

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// useAddNomination (optimistic)
// ---------------------------------------------------------------------------

describe("useAddNomination", () => {
  it("nominates the review's work for the category", async () => {
    server.use(...awardsApi({ awards: [{ title: "Best Picture", nominations: [] }] }));

    const { result } = withSetup(withYear(() => useAddNomination("test-club", "2024")));

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:"]);
    });

    result.mutation.mutate({
      awardTitle: "Best Picture",
      review: {
        id: "r-1",
        title: "The Shawshank Redemption",
        type: WorkType.movie,
        createdDate: "2024-01-01T00:00:00.000Z",
        // The nomination is keyed by TMDB id, so this is what lands.
        externalId: "278",
        imageUrl: "https://img.test/poster.jpg",
        scores: {},
      },
    });

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:278"]);
    });
  });

  it("fails the mutation when the review has no externalId", async () => {
    const { result } = withSetup(() => useAddNomination("test-club", "2024"));

    result.mutate({
      awardTitle: "Best Picture",
      review: {
        id: "r-bad",
        title: "Mystery Film",
        type: WorkType.movie,
        createdDate: "2024-01-01T00:00:00.000Z",
        scores: {},
      },
    });

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeleteNomination (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteNomination", () => {
  it("takes the nomination off the category", async () => {
    server.use(
      ...awardsApi({
        awards: [
          {
            title: "Best Picture",
            nominations: [nomination(278), nomination(389)],
          },
        ],
      }),
    );

    const { result } = withSetup(withYear(() => useDeleteNomination("test-club", "2024")));

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:278+389"]);
    });

    result.mutation.mutate({ awardTitle: "Best Picture", movieId: 278 });

    await vi.waitFor(() => {
      expect(categories(result.year)).toEqual(["Best Picture:389"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useSubmitRanking
// ---------------------------------------------------------------------------

describe("useSubmitRanking", () => {
  it("records the ranking in the order the caller gave", async () => {
    server.use(
      ...awardsApi({
        awards: [
          {
            title: "Best Picture",
            nominations: [nomination(278), nomination(389)],
          },
        ],
      }),
    );

    const rankings = () =>
      result.year.data.value?.awards[0]?.nominations.map(
        (n) => [n.movieId, Object.values(n.ranking)] as const,
      );

    const { result } = withSetup(withYear(() => useSubmitRanking("test-club", "2024")));

    await vi.waitFor(() => {
      expect(rankings()).toEqual([
        [278, []],
        [389, []],
      ]);
    });

    result.mutation.mutate({ awardTitle: "Best Picture", movies: [389, 278] });

    await vi.waitFor(() => {
      expect(rankings()).toEqual([
        [278, [2]],
        [389, [1]],
      ]);
    });
  });
});
