import { useQueryClient } from "@tanstack/vue-query";
import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import {
  useClub,
  useClubDetails,
  useClubSettings,
  useClubSlug,
  useCreateClub,
  useIsInClub,
  useLeaveClub,
  useMembers,
  useUpdateClubSettings,
} from "../useClub";
import { ClubType } from "@/../lib/types/generated/db";
import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// ---------------------------------------------------------------------------
// useClub
// ---------------------------------------------------------------------------

describe("useClub", () => {
  it("loads the club the slug names", async () => {
    server.use(
      http.get("/api/club/:id", ({ params }) =>
        HttpResponse.json({
          clubId: "42",
          clubName: `Club ${String(params.id)}`,
          slug: String(params.id),
        }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useClub("sci-fi");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.clubName : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Club sci-fi");
  });

  it("propagates errors from the API", async () => {
    server.use(http.get("/api/club/:id", () => new HttpResponse(null, { status: 404 })));

    const Harness = defineComponent({
      setup() {
        // Disable retries so the error surfaces immediately instead of after
        // 3 retries with exponential backoff (~7 s total by default).
        useQueryClient().setDefaultOptions({ queries: { retry: false } });
        const { isError, error } = useClub("missing");
        return { isError, error };
      },
      template: `<div>{{ isError ? 'error' : 'ok' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("error");
  });
});

// ---------------------------------------------------------------------------
// useMembers
// ---------------------------------------------------------------------------

describe("useMembers", () => {
  it("loads the members of the club the slug names", async () => {
    server.use(
      http.get("/api/club/:id/members", ({ params }) =>
        HttpResponse.json([
          { id: "1", name: `Alice of ${String(params.id)}`, email: "alice@test.com" },
          { id: "2", name: "Bob", email: "bob@test.com" },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useMembers("test-club");
        return { data, isSuccess };
      },
      template: `<div v-if="isSuccess">{{ data?.map((m) => m.name).join(", ") }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Alice of test-club, Bob");
  });
});

// ---------------------------------------------------------------------------
// useClubSlug
// ---------------------------------------------------------------------------

describe("useClubSlug", () => {
  it("returns clubSlug from route params (mocked as test-club)", () => {
    const Harness = defineComponent({
      setup() {
        const slug = useClubSlug();
        return { slug };
      },
      template: `<div>{{ slug }}</div>`,
    });

    const rendered = render(Harness);
    expect(rendered.getByText("test-club")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useIsInClub
// ---------------------------------------------------------------------------

describe("useIsInClub", () => {
  it("reports the user is not in the club while their clubs are unknown", async () => {
    const Harness = defineComponent({
      setup() {
        const isIn = useIsInClub("my-club");
        return { isIn };
      },
      template: `<div>{{ isIn ? 'member' : 'not-member' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("not-member");
  });
});

// ---------------------------------------------------------------------------
// useCreateClub
// ---------------------------------------------------------------------------

describe("useCreateClub", () => {
  it("creates a club under the name the caller gave", async () => {
    server.use(
      http.post("/api/club", async ({ request }) => {
        // The API names the field `name`; the composable takes `clubName`.
        const { name, type } = (await request.json()) as { name?: string; type: ClubType };
        return HttpResponse.json({ clubId: "new-1", slug: `${type}-${name ?? "unnamed"}` });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, data } = useCreateClub();
        const submit = () =>
          mutate({
            clubName: "New Club",
            members: ["alice@test.com"],
            type: ClubType.movie,
          });
        return { submit, data };
      },
      template: `<button @click="submit">{{ data?.data.slug ?? 'create' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "movie-New Club" });
  });
});

// ---------------------------------------------------------------------------
// useClubSettings
// ---------------------------------------------------------------------------

describe("useClubSettings", () => {
  it("fetches club settings from /api/club/:id/settings", async () => {
    server.use(
      http.get("/api/club/:id/settings", () =>
        HttpResponse.json({ features: { awards: false, discussionQuestions: true } }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useClubSettings("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? String(data?.features.discussionQuestions) : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("true");
  });
});

// ---------------------------------------------------------------------------
// useUpdateClubSettings (optimistic update + rollback)
// ---------------------------------------------------------------------------

describe("useUpdateClubSettings", () => {
  it("shows the new value before the server responds, then keeps it on success", async () => {
    const initial = { features: { awards: false, discussionQuestions: false } };
    let resolvePost: (() => void) | undefined;
    server.use(
      http.get("/api/club/:id/settings", () => HttpResponse.json(initial)),
      http.post("/api/club/:id/settings", async () => {
        // Hold the response open so the optimistic value is observable.
        await new Promise<void>((resolve) => (resolvePost = resolve));
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { data: settings } = useClubSettings("test-club");
        const { mutate } = useUpdateClubSettings("test-club");
        const trigger = () => mutate({ features: { awards: true } });
        return { settings, trigger };
      },
      template: `<button @click="trigger">awards: {{ String(settings?.features.awards) }}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "awards: false" });

    rendered.getByRole("button").click();
    // onMutate writes the merged settings into the cache immediately.
    await rendered.findByRole("button", { name: "awards: true" });

    resolvePost?.();
    await rendered.findByRole("button", { name: "awards: true" });
  });

  it("rolls back to the previous settings when the request fails", async () => {
    server.use(
      http.get("/api/club/:id/settings", () =>
        HttpResponse.json({ features: { awards: false, discussionQuestions: false } }),
      ),
      http.post("/api/club/:id/settings", () => new HttpResponse(null, { status: 500 })),
    );

    const Harness = defineComponent({
      setup() {
        const { data: settings } = useClubSettings("test-club");
        const { mutate } = useUpdateClubSettings("test-club");
        const trigger = () => mutate({ features: { awards: true } });
        return { settings, trigger };
      },
      template: `<button @click="trigger">awards: {{ String(settings?.features.awards) }}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "awards: false" });

    rendered.getByRole("button").click();
    await rendered.findByRole("button", { name: "awards: true" });
    // onError restores the snapshot taken in onMutate.
    await rendered.findByRole("button", { name: "awards: false" });
  });

  it("persists the change, so a refetch still reports it", async () => {
    let stored = { features: { awards: false, discussionQuestions: false } };
    server.use(
      http.get("/api/club/:id/settings", () => HttpResponse.json(stored)),
      http.post("/api/club/:id/settings", async ({ request }) => {
        const body = (await request.json()) as { features?: Partial<typeof stored.features> };
        stored = { features: { ...stored.features, ...body.features } };
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { data: settings } = useClubSettings("test-club");
        const { mutate } = useUpdateClubSettings("test-club");
        const trigger = () => mutate({ features: { discussionQuestions: true } });
        return { trigger, settings };
      },
      template: `<button @click="trigger">questions: {{ String(settings?.features.discussionQuestions) }}, awards: {{ String(settings?.features.awards) }}</button>`,
    });

    const rendered = render(Harness);
    await rendered.findByRole("button", { name: "questions: false, awards: false" });

    rendered.getByRole("button").click();

    // The invalidated query re-reads what the server actually stored.
    await rendered.findByRole("button", { name: "questions: true, awards: false" });
  });
});

// ---------------------------------------------------------------------------
// useClubDetails
// ---------------------------------------------------------------------------

describe("useClubDetails", () => {
  it("fetches join info from /api/club/joinInfo/:token", async () => {
    server.use(
      http.get("/api/club/joinInfo/:token", () =>
        HttpResponse.json({
          clubId: "5",
          clubName: "Horror Club",
          slug: "horror",
        }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useClubDetails("invite-abc");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.clubName : 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Horror Club");
  });
});

// ---------------------------------------------------------------------------
// useLeaveClub
// ---------------------------------------------------------------------------

describe("useLeaveClub", () => {
  it("reports success once the club drops the member", async () => {
    server.use(
      http.delete("/api/club/:id/members/self", () => new HttpResponse(null, { status: 200 })),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useLeaveClub("test-club");
        return { mutate, isSuccess };
      },
      template: `<button @click="mutate()">{{ isSuccess ? 'left' : 'leave' }}</button>`,
    });

    const rendered = render(Harness);
    rendered.getByRole("button").click();

    await rendered.findByText("left");
  });
});
