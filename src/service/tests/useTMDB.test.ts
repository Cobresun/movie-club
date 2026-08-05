import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

import { useWatchProviders } from "../useTMDB";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// ---------------------------------------------------------------------------
// useWatchProviders
// ---------------------------------------------------------------------------

describe("useWatchProviders", () => {
  it("fetches watch providers for a given externalId", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () =>
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
      http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () => {
        fetchCalled = true;
        return HttpResponse.json({ id: 0, results: {} });
      }),
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
