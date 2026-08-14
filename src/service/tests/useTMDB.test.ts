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

    const rendered = render(Harness);
    await rendered.findByText("Netflix");
  });

  it("does not fetch when externalId is undefined", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () => {
        throw new Error("There is no work to ask TMDB about");
      }),
    );

    const Harness = defineComponent({
      setup() {
        const externalId = ref<string | undefined>(undefined);
        const { status, fetchStatus } = useWatchProviders(externalId);
        return { status, fetchStatus };
      },
      template: `<div>{{ status }}/{{ fetchStatus }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("loading/idle");
  });
});
