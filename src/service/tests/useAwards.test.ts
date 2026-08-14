import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

import { AwardsStep } from "../../../lib/types/awards";
import { WorkType } from "../../../lib/types/generated/db";
import {
  useAddCategory,
  useAddNomination,
  useAwards,
  useAwardYears,
  useDeleteCategory,
  useDeleteNomination,
  useSubmitRanking,
  useUpdateStep,
} from "../useAwards";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

/** Renders the year as text: its step, then each category and its nominees. */
const AWARDS = `{{ awards?.step }} | {{ awards?.awards.map((a) => a.title + ':' + a.nominations.map((n) => n.movieId).join('+')).join(', ') || 'no categories' }}`;

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
function awardsApi(initial: { step?: string; awards?: FakeAward[] } = {}) {
  const year = {
    year: "2024",
    step: initial.step ?? "nominations",
    awards: initial.awards ?? [],
  };
  const base = "/api/club/:id/awards/:year";
  const award = (title: unknown) => year.awards.find((entry) => entry.title === String(title));
  const ok = () => new HttpResponse(null, { status: 200 });

  return [
    http.get(base, () => HttpResponse.json(year)),
    http.put(`${base}/step`, async ({ request }) => {
      ({ step: year.step } = (await request.json()) as { step: string });
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

/** A component that shows the year and runs `use` against it. */
function harness(use: () => { trigger: () => void }) {
  return defineComponent({
    setup() {
      const { data: awards } = useAwards(ref("test-club"), ref("2024"));
      return { awards, ...use() };
    },
    template: `<button @click="trigger">${AWARDS}</button>`,
  });
}

// ---------------------------------------------------------------------------
// useAwardYears
// ---------------------------------------------------------------------------

describe("useAwardYears", () => {
  it("lists the years the club has run awards for", async () => {
    server.use(http.get("/api/club/:id/awards/years", () => HttpResponse.json([2022, 2023, 2024])));

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useAwardYears("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.join(',') : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("2022,2023,2024");
  });
});

// ---------------------------------------------------------------------------
// useAwards
// ---------------------------------------------------------------------------

describe("useAwards", () => {
  it("loads the year the refs name", async () => {
    server.use(
      http.get("/api/club/:id/awards/:year", ({ params }) =>
        HttpResponse.json({ year: params.year, step: `step of ${String(params.id)}`, awards: [] }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useAwards(ref("test-club"), ref("2024"));
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.year + '/' + data?.step : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("2024/step of test-club");
  });

  it("swaps to the other year when the year ref changes", async () => {
    server.use(
      http.get("/api/club/:id/awards/:year", ({ params }) =>
        HttpResponse.json({ year: params.year, step: "nominations", awards: [] }),
      ),
    );

    const year = ref("2023");

    const Harness = defineComponent({
      setup() {
        const { data } = useAwards(ref("test-club"), year);
        return { data };
      },
      template: `<div>{{ data?.year ?? 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("2023");

    year.value = "2024";

    await rendered.findByText("2024");
  });
});

// ---------------------------------------------------------------------------
// useUpdateStep
// ---------------------------------------------------------------------------

describe("useUpdateStep", () => {
  it("moves the year to the given step", async () => {
    server.use(...awardsApi({ step: String(AwardsStep.Nominations) }));

    const Harness = harness(() => {
      const { mutate } = useUpdateStep(ref("test-club"), ref("2024"));
      return { trigger: () => mutate(AwardsStep.Ratings) };
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", {
      name: `${String(AwardsStep.Nominations)} | no categories`,
    });

    button.click();

    await rendered.findByRole("button", { name: `${String(AwardsStep.Ratings)} | no categories` });
  });
});

// ---------------------------------------------------------------------------
// useAddCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useAddCategory", () => {
  it("adds the category to the year", async () => {
    server.use(...awardsApi());

    const Harness = harness(() => {
      const { mutate } = useAddCategory("test-club", "2024");
      return { trigger: () => mutate("Best Picture") };
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "nominations | no categories" });

    button.click();

    await rendered.findByRole("button", { name: "nominations | Best Picture:" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteCategory", () => {
  it("removes a category whose title needs escaping in the url", async () => {
    server.use(...awardsApi({ awards: [{ title: "Best Picture", nominations: [] }] }));

    const Harness = harness(() => {
      const { mutate } = useDeleteCategory("test-club", "2024");
      return { trigger: () => mutate({ title: "Best Picture", nominations: [] }) };
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "nominations | Best Picture:" });

    button.click();

    await rendered.findByRole("button", { name: "nominations | no categories" });
  });
});

// ---------------------------------------------------------------------------
// useAddNomination (optimistic)
// ---------------------------------------------------------------------------

describe("useAddNomination", () => {
  it("nominates the review's work for the category", async () => {
    server.use(...awardsApi({ awards: [{ title: "Best Picture", nominations: [] }] }));

    const Harness = harness(() => {
      const { mutate } = useAddNomination("test-club", "2024");
      return {
        trigger: () =>
          mutate({
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
          }),
      };
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "nominations | Best Picture:" });

    button.click();

    await rendered.findByRole("button", { name: "nominations | Best Picture:278" });
  });

  it("throws when review has no externalId", async () => {
    const Harness = defineComponent({
      setup() {
        const { mutate, isError } = useAddNomination("test-club", "2024");
        const badReview = {
          id: "r-bad",
          title: "Mystery Film",
          type: "movie" as const,
          createdDate: "2024-01-01T00:00:00.000Z",
          scores: {},
        };
        return { mutate, isError, badReview };
      },
      template: `<button @click="() => mutate({ awardTitle: 'Best Picture', review: badReview })">{{ isError ? 'error' : 'go' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();
    await rendered.findByText("error");
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
            nominations: [
              { movieId: 278, movieTitle: "Movie 278", nominatedBy: [], ranking: {} },
              { movieId: 389, movieTitle: "Movie 389", nominatedBy: [], ranking: {} },
            ],
          },
        ],
      }),
    );

    const Harness = harness(() => {
      const { mutate } = useDeleteNomination("test-club", "2024");
      return { trigger: () => mutate({ awardTitle: "Best Picture", movieId: 278 }) };
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", {
      name: "nominations | Best Picture:278+389",
    });

    button.click();

    await rendered.findByRole("button", { name: "nominations | Best Picture:389" });
  });
});

// ---------------------------------------------------------------------------
// useSubmitRanking
// ---------------------------------------------------------------------------

describe("useSubmitRanking", () => {
  it("records the ranking against the nominations", async () => {
    server.use(
      ...awardsApi({
        awards: [
          {
            title: "Best Picture",
            nominations: [
              { movieId: 278, movieTitle: "Movie 278", nominatedBy: [], ranking: {} },
              { movieId: 389, movieTitle: "Movie 389", nominatedBy: [], ranking: {} },
            ],
          },
        ],
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { data: awards } = useAwards(ref("test-club"), ref("2024"));
        const { mutate } = useSubmitRanking("test-club", "2024");
        return {
          awards,
          trigger: () => mutate({ awardTitle: "Best Picture", movies: [389, 278] }),
        };
      },
      template: `<button @click="trigger">{{ awards?.awards[0]?.nominations.map((n) => n.movieId + '=' + Object.values(n.ranking).join()).join(', ') ?? 'loading' }}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "278=, 389=" });

    button.click();

    // The ranking arrived in the order the caller gave: 389 first, then 278.
    await rendered.findByRole("button", { name: "278=2, 389=1" });
  });
});
