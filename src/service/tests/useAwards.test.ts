import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

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

// ---------------------------------------------------------------------------
// useAwardYears
// ---------------------------------------------------------------------------

describe("useAwardYears", () => {
  it("fetches years from /api/club/:id/awards/years", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/club/:id/awards/years", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([2022, 2023, 2024]);
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useAwardYears("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.join(',') : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("2022,2023,2024");
    expect(capturedUrl).toContain("/api/club/test-club/awards/years");
  });
});

// ---------------------------------------------------------------------------
// useAwards
// ---------------------------------------------------------------------------

describe("useAwards", () => {
  it("fetches awards from /api/club/:id/awards/:year", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/club/:id/awards/:year", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          year: "2024",
          step: "nominations",
          awards: [],
        });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const clubId = ref("test-club");
        const year = ref("2024");
        const { data, isSuccess } = useAwards(clubId, year);
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.step : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("nominations");
    expect(capturedUrl).toContain("/api/club/test-club/awards/2024");
  });

  it("refetches when year ref changes", async () => {
    const fetchedYears: string[] = [];
    server.use(
      http.get("/api/club/:id/awards/:year", ({ params }) => {
        fetchedYears.push(String(params.year));
        return HttpResponse.json({
          year: params.year,
          step: "nominations",
          awards: [],
        });
      }),
    );

    const clubId = ref("test-club");
    const year = ref("2023");

    const Harness = defineComponent({
      setup() {
        const { data } = useAwards(clubId, year);
        return { data };
      },
      template: `<div>{{ data?.year }}</div>`,
    });

    render(Harness);

    const { waitFor } = await import("@testing-library/vue");
    await waitFor(() => expect(fetchedYears).toContain("2023"));

    year.value = "2024";
    await waitFor(() => expect(fetchedYears).toContain("2024"));
  });
});

// ---------------------------------------------------------------------------
// useUpdateStep
// ---------------------------------------------------------------------------

describe("useUpdateStep", () => {
  it("PUTs the new step to /api/club/:id/awards/:year/step", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put("/api/club/:id/awards/:year/step", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const clubId = ref("test-club");
        const year = ref("2024");
        const { mutate, isSuccess } = useUpdateStep(clubId, year);
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('rankings')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ step: "rankings" });
  });
});

// ---------------------------------------------------------------------------
// useAddCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useAddCategory", () => {
  it("POSTs a new category title to /api/club/:id/awards/:year/category", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/awards/:year/category", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useAddCategory("test-club", "2024");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('Best Picture')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ title: "Best Picture" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteCategory (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteCategory", () => {
  it("DELETEs category by title (URL-encoded)", async () => {
    let capturedPath = "";
    server.use(
      http.delete(
        "/api/club/:id/awards/:year/category/:title",
        ({ request }) => {
          capturedPath = new URL(request.url).pathname;
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteCategory("test-club", "2024");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate({ title: 'Best Picture', nominations: [] })">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedPath).toContain("Best%20Picture");
  });
});

// ---------------------------------------------------------------------------
// useAddNomination (optimistic)
// ---------------------------------------------------------------------------

describe("useAddNomination", () => {
  it("POSTs a nomination to /api/club/:id/awards/:year/nomination", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(
        "/api/club/:id/awards/:year/nomination",
        async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const mockReview = {
      id: "r-1",
      title: "The Shawshank Redemption",
      type: "movie" as const,
      createdDate: "2024-01-01T00:00:00.000Z",
      externalId: "278",
      imageUrl: "https://img.test/poster.jpg",
      scores: {},
    };

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useAddNomination("test-club", "2024");
        const payload = { awardTitle: "Best Picture", review: mockReview };
        return { mutate, isSuccess, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toMatchObject({
      awardTitle: "Best Picture",
      movieId: 278,
    });
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

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("error");
  });
});

// ---------------------------------------------------------------------------
// useDeleteNomination (optimistic)
// ---------------------------------------------------------------------------

describe("useDeleteNomination", () => {
  it("DELETEs nomination by movieId", async () => {
    let deletedMovieId = "";
    server.use(
      http.delete(
        "/api/club/:id/awards/:year/nomination/:movieId",
        ({ params }) => {
          deletedMovieId = String(params.movieId);
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteNomination("test-club", "2024");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate({ awardTitle: 'Best Picture', movieId: 278 })">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(deletedMovieId).toBe("278");
  });
});

// ---------------------------------------------------------------------------
// useSubmitRanking
// ---------------------------------------------------------------------------

describe("useSubmitRanking", () => {
  it("POSTs ranking to /api/club/:id/awards/:year/ranking", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/awards/:year/ranking", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useSubmitRanking("test-club", "2024");
        const payload = { awardTitle: "Best Picture", movies: [278, 389] };
        return { mutate, isSuccess, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toMatchObject({
      awardTitle: "Best Picture",
      movies: [278, 389],
    });
  });
});
