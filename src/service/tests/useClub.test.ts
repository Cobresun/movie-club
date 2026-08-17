import { http, HttpResponse } from "msw";
import { watch } from "vue";

import { useClubSettings, useCreateClub, useIsInClub, useUpdateClubSettings } from "../useClub";
import { ClubType } from "@/../lib/types/generated/db";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

/**
 * Runs the settings query and its mutation, and records every value `awards`
 * takes. The optimistic write, the rollback and the refetch that follows all
 * land within a few ticks, so the recorded sequence is what shows them —
 * polling would miss the middle values.
 */
function trackAwards() {
  const settings = useClubSettings("test-club");
  const update = useUpdateClubSettings("test-club");
  const seen: (boolean | undefined)[] = [];

  watch(
    () => settings.data.value?.features.awards,
    (awards) => {
      if (seen.at(-1) !== awards) seen.push(awards);
    },
    { immediate: true, flush: "sync" },
  );

  return { settings, update, seen };
}

/** Club settings the POST actually stores, so a refetch reports the new value. */
function settingsApi(hold?: { until: Promise<void> }) {
  const stored = { features: { awards: false, discussionQuestions: false } };

  return {
    stored,
    handlers: [
      http.get("/api/club/:id/settings", () => HttpResponse.json(stored)),
      http.post("/api/club/:id/settings", async ({ request }) => {
        const body = (await request.json()) as { features?: Partial<typeof stored.features> };
        await hold?.until;
        Object.assign(stored.features, body.features);
        return new HttpResponse(null, { status: 200 });
      }),
    ],
  };
}

describe("useIsInClub", () => {
  it("reports the user is not in the club while their clubs are unknown", async () => {
    const { result } = withSetup(() => useIsInClub("my-club"));

    await vi.waitFor(() => {
      expect(result.value).toBe(false);
    });
  });
});

describe("useCreateClub", () => {
  it("sends the caller's clubName as the API's name field", async () => {
    server.use(
      http.post("/api/club", async ({ request }) => {
        // The API names the field `name`; the composable takes `clubName`.
        const { name, type } = (await request.json()) as { name?: string; type: ClubType };
        return HttpResponse.json({ clubId: "new-1", slug: `${type}-${name ?? "unnamed"}` });
      }),
    );

    const { result } = withSetup(() => useCreateClub());

    result.mutate({
      clubName: "New Club",
      members: ["alice@test.com"],
      type: ClubType.movie,
    });

    await vi.waitFor(() => {
      expect(result.data.value?.data.slug).toBe("movie-New Club");
    });
  });
});

describe("useUpdateClubSettings", () => {
  it("shows the new value before the server responds, then keeps it on success", async () => {
    let release!: () => void;
    const api = settingsApi({ until: new Promise<void>((resolve) => (release = resolve)) });
    server.use(...api.handlers);

    const { result } = withSetup(trackAwards);

    await vi.waitFor(() => {
      expect(result.settings.data.value?.features.awards).toBe(false);
    });

    // onMutate writes the merged settings into the cache while the POST is
    // still in flight — the server has not stored anything yet.
    result.update.mutate({ features: { awards: true } });
    await vi.waitFor(() => {
      expect(result.settings.data.value?.features.awards).toBe(true);
    });
    expect(api.stored.features.awards).toBe(false);

    release();

    // onSettled invalidates, and the refetch confirms rather than reverts it.
    await vi.waitFor(() => {
      expect(result.update.isSuccess.value).toBe(true);
      expect(result.settings.isFetching.value).toBe(false);
    });
    expect(result.seen).toEqual([false, true]);
  });

  it("rolls back to the previous settings when the request fails", async () => {
    server.use(
      http.get("/api/club/:id/settings", () =>
        HttpResponse.json({ features: { awards: false, discussionQuestions: false } }),
      ),
      http.post("/api/club/:id/settings", () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = withSetup(trackAwards);

    await vi.waitFor(() => {
      expect(result.settings.data.value?.features.awards).toBe(false);
    });

    result.update.mutate({ features: { awards: true } });

    await vi.waitFor(() => {
      expect(result.update.isError.value).toBe(true);
    });
    // The optimistic true was shown, then onError restored the snapshot.
    expect(result.seen).toEqual([false, true, false]);
  });

  it("merges a partial update, leaving the other features alone", async () => {
    const api = settingsApi();
    server.use(...api.handlers);

    const { result } = withSetup(() => ({
      settings: useClubSettings("test-club"),
      update: useUpdateClubSettings("test-club"),
    }));

    await vi.waitFor(() => {
      expect(result.settings.data.value?.features).toEqual({
        awards: false,
        discussionQuestions: false,
      });
    });

    result.update.mutate({ features: { discussionQuestions: true } });

    // The invalidated query re-reads what the server actually stored.
    await vi.waitFor(() => {
      expect(result.update.isSuccess.value).toBe(true);
      expect(result.settings.data.value?.features).toEqual({
        awards: false,
        discussionQuestions: true,
      });
    });
  });
});
