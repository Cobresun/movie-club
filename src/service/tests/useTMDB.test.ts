import { http } from "msw";
import { ref } from "vue";

import { useWatchProviders } from "../useTMDB";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

describe("useWatchProviders", () => {
  it("does not fetch when externalId is undefined", async () => {
    server.use(
      http.get("https://api.themoviedb.org/3/movie/:movieId/watch/providers", () => {
        throw new Error("There is no work to ask TMDB about");
      }),
    );

    const { result } = withSetup(() => useWatchProviders(ref<string | undefined>(undefined)));

    await vi.waitFor(() => {
      expect(result.status.value).toBe("loading");
      expect(result.fetchStatus.value).toBe("idle");
    });
  });
});
