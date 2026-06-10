import { waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

import { useCollection, useSearch, useWatchProviders } from "../useTMDB";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// ---------------------------------------------------------------------------
// useSearch
// ---------------------------------------------------------------------------

describe("useSearch", () => {
  it("fetches TMDB search results from the search/movie endpoint", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () =>
        HttpResponse.json({
          page: 1,
          results: [{ id: 389, title: "12 Angry Men" }],
          total_pages: 1,
          total_results: 1,
        }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const query = ref("12 Angry");
        const { data, isSuccess } = useSearch(query, true);
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.results[0]?.title : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("12 Angry Men");
  });

  it("does not fetch when enabled is false", async () => {
    let fetchCalled = false;
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", () => {
        fetchCalled = true;
        return HttpResponse.json({
          page: 1,
          results: [],
          total_pages: 1,
          total_results: 0,
        });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const query = ref("something");
        const { isLoading } = useSearch(query, false);
        return { isLoading };
      },
      template: `<div>{{ isLoading ? 'loading' : 'idle' }}</div>`,
    });

    render(Harness);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
  });

  it("refetches when query ref changes", async () => {
    const capturedQueries: string[] = [];
    server.use(
      http.get("https://api.themoviedb.org/3/search/movie", ({ request }) => {
        const url = new URL(request.url);
        capturedQueries.push(url.searchParams.get("query") ?? "");
        return HttpResponse.json({
          page: 1,
          results: [],
          total_pages: 1,
          total_results: 0,
        });
      }),
    );

    const query = ref("first");

    const Harness = defineComponent({
      setup() {
        const { data } = useSearch(query, true);
        return { data };
      },
      template: `<div>ok</div>`,
    });

    render(Harness);
    await waitFor(() => expect(capturedQueries).toContain("first"));

    query.value = "second";
    await waitFor(() => expect(capturedQueries).toContain("second"));
  });
});

// ---------------------------------------------------------------------------
// useCollection
// ---------------------------------------------------------------------------

describe("useCollection", () => {
  it("fetches a TMDB movie collection", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/movie/:collection", () =>
        HttpResponse.json({
          page: 1,
          results: [{ id: 1, title: "Popular Movie" }],
          total_pages: 1,
          total_results: 1,
        }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const collection = ref("popular" as const);
        const { data, isSuccess } = useCollection(collection);
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.results[0]?.title : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("Popular Movie");
  });
});

// ---------------------------------------------------------------------------
// useWatchProviders
// ---------------------------------------------------------------------------

describe("useWatchProviders", () => {
  it("fetches watch providers for a given externalId", async () => {
    server.use(
      http.get(
        "https://api.themoviedb.org/3/movie/:movieId/watch/providers",
        () =>
          HttpResponse.json({
            id: 389,
            results: {
              US: {
                flatrate: [
                  {
                    provider_id: 8,
                    provider_name: "Netflix",
                    logo_path: "/n.jpg",
                    display_priority: 1,
                  },
                ],
              },
            },
          }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const externalId = ref<string | undefined>("389");
        const { data, isSuccess } = useWatchProviders(externalId);
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.results?.US?.flatrate?.[0]?.provider_name : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("Netflix");
  });

  it("does not fetch when externalId is undefined", async () => {
    let fetchCalled = false;
    server.use(
      http.get(
        "https://api.themoviedb.org/3/movie/:movieId/watch/providers",
        () => {
          fetchCalled = true;
          return HttpResponse.json({ id: 0, results: {} });
        },
      ),
    );

    const Harness = defineComponent({
      setup() {
        const externalId = ref<string | undefined>(undefined);
        const { isLoading } = useWatchProviders(externalId);
        return { isLoading };
      },
      template: `<div>{{ isLoading ? 'loading' : 'idle' }}</div>`,
    });

    render(Harness);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
  });
});
