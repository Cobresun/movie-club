import { useQueryClient } from "@tanstack/vue-query";
import { delay, http, HttpResponse } from "msw";
import { watch } from "vue";
import { z } from "zod";

import { useClub, useCreateClub, useIsInClub, useUpdateClubSettings } from "../useClub";
import { useUserClubs } from "../useUser";
import { type ClubPreview, DEFAULT_CLUB_SETTINGS } from "@/../lib/types/club";
import { ClubType } from "@/../lib/types/generated/db";
import club from "@/mocks/data/club";
import { server } from "@/mocks/server";
import { logIn, withSetup } from "@/tests/utils";

/**
 * Runs the club query and the settings mutation, and records every value
 * `awards` takes. The optimistic write, the rollback and the refetch that
 * follows all land within a few ticks, so the recorded sequence is what shows
 * them — polling would miss the middle values.
 */
function trackAwards() {
  const preview = useClub("test-club");
  const update = useUpdateClubSettings("test-club");
  const seen: (boolean | undefined)[] = [];

  watch(
    () => preview.data.value?.settings.features.awards,
    (awards) => {
      if (seen.at(-1) !== awards) seen.push(awards);
    },
    { immediate: true, flush: "sync" },
  );

  return { preview, update, seen };
}

/** Club settings the POST actually stores, so a refetch reports the new value. */
const settingsBodySchema = z.object({
  features: z
    .object({
      awards: z.boolean(),
    })
    .partial()
    .optional(),
});

const createClubBodySchema = z.object({
  name: z.string().optional(),
  type: z.nativeEnum(ClubType),
});

function settingsApi(hold?: { until: Promise<void> }) {
  const stored = { features: { awards: false } };

  return {
    stored,
    handlers: [
      http.get("/api/club/:id", () =>
        HttpResponse.json<ClubPreview>({ ...club, settings: structuredClone(stored) }),
      ),
      http.post("/api/club/:id/settings", async ({ request }) => {
        const { features } = settingsBodySchema.parse(await request.json());
        await hold?.until;
        Object.assign(stored.features, features);
        return new HttpResponse(null, { status: 200 });
      }),
    ],
  };
}

describe("useClub", () => {
  const preview: ClubPreview = {
    clubId: "7",
    clubName: "Friday Films",
    slug: "friday-films",
    slugUpdatedAt: undefined,
    type: ClubType.MOVIE,
    settings: DEFAULT_CLUB_SETTINGS,
  };

  it("has a member's club straight away, from their clubs list", () => {
    server.use(http.get("/api/club/:slug", () => delay("infinite")));

    const { result } = withSetup(() => {
      useQueryClient().setQueryData<ClubPreview[]>(["user", "clubs"], [preview]);
      return useClub("friday-films");
    });

    expect(result.data.value).toStrictEqual(preview);
    expect(result.isLoading.value).toBe(false);
  });

  it("takes the server's copy once it arrives", async () => {
    server.use(
      http.get("/api/club/:slug", () =>
        HttpResponse.json<ClubPreview>({ ...preview, clubName: "Saturday Films" }),
      ),
    );

    const { result } = withSetup(() => {
      useQueryClient().setQueryData<ClubPreview[]>(["user", "clubs"], [preview]);
      return useClub("friday-films");
    });

    await vi.waitFor(() => {
      expect(result.data.value?.clubName).toBe("Saturday Films");
    });
  });

  it("loads a club that is not on the clubs list", async () => {
    server.use(http.get("/api/club/:slug", () => HttpResponse.json<ClubPreview>(preview)));

    const { result } = withSetup(() => {
      useQueryClient().setQueryData<ClubPreview[]>(
        ["user", "clubs"],
        [{ ...preview, clubId: "8", slug: "another-club" }],
      );
      return useClub("friday-films");
    });

    expect(result.data.value).toBeUndefined();
    await vi.waitFor(() => {
      expect(result.data.value?.clubName).toBe("Friday Films");
    });
  });
});

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
        const { name, type } = createClubBodySchema.parse(await request.json());
        return HttpResponse.json({ clubId: "new-1", slug: `${type}-${name}` });
      }),
    );

    const { result } = withSetup(() => useCreateClub());

    result.mutate({
      clubName: "New Club",
      members: ["alice@test.com"],
      type: ClubType.MOVIE,
    });

    await vi.waitFor(() => {
      expect(result.data.value?.data.slug).toBe("movie-New Club");
    });
  });
});

describe("useUpdateClubSettings", () => {
  it("shows the new value before the server responds, then keeps it on success", async () => {
    let release!: () => void;
    const api = settingsApi({
      until: new Promise<void>((resolve) => {
        release = resolve;
      }),
    });
    server.use(...api.handlers);

    const { result } = withSetup(trackAwards);

    await vi.waitFor(() => {
      expect(result.preview.data.value?.settings.features.awards).toBe(false);
    });

    // onMutate writes the merged settings into the cache while the POST is
    // still in flight — the server has not stored anything yet.
    result.update.mutate({ features: { awards: true } });
    await vi.waitFor(() => {
      expect(result.preview.data.value?.settings.features.awards).toBe(true);
    });
    expect(api.stored.features.awards).toBe(false);

    release();

    // onSettled invalidates, and the refetch confirms rather than reverts it.
    await vi.waitFor(() => {
      expect(result.update.isSuccess.value).toBe(true);
      expect(result.preview.isFetching.value).toBe(false);
    });
    expect(result.seen).toStrictEqual([false, true]);
  });

  it("changes the club's entry in the member's clubs list too", async () => {
    let release!: () => void;
    const api = settingsApi({
      until: new Promise<void>((resolve) => {
        release = resolve;
      }),
    });
    server.use(
      ...api.handlers,
      http.get("/api/member/clubs", () =>
        HttpResponse.json<ClubPreview[]>([{ ...club, settings: structuredClone(api.stored) }]),
      ),
    );

    const { result, pinia } = withSetup(() => ({ clubs: useUserClubs(), ...trackAwards() }));
    logIn(pinia);
    await vi.waitFor(() => {
      expect(result.clubs.data.value?.[0]?.settings.features.awards).toBe(false);
    });

    result.update.mutate({ features: { awards: true } });

    await vi.waitFor(() => {
      expect(result.clubs.data.value?.[0]?.settings.features.awards).toBe(true);
    });
    expect(api.stored.features.awards).toBe(false);
    release();
  });

  it("rolls back to the previous settings when the request fails", async () => {
    server.use(
      http.get("/api/club/:id", () => HttpResponse.json<ClubPreview>(club)),
      http.post("/api/club/:id/settings", () => new HttpResponse(null, { status: 500 })),
    );

    const { result } = withSetup(trackAwards);

    await vi.waitFor(() => {
      expect(result.preview.data.value?.settings.features.awards).toBe(false);
    });

    result.update.mutate({ features: { awards: true } });

    await vi.waitFor(() => {
      expect(result.update.isError.value).toBe(true);
    });
    // The optimistic true was shown, then onError restored the snapshot.
    expect(result.seen).toStrictEqual([false, true, false]);
  });
});
