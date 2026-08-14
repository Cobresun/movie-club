import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import { useDeleteAvatar, useUpdateAvatar, useUpdateName, useUser, useUserClubs } from "../useUser";
import { server } from "@/mocks/server";
import { useAuthStore } from "@/stores/auth";
import { render } from "@/tests/utils";

// Ensure auth.refreshSession resolves (createTestingPinia stubs it to return
// undefined, but production code chains .catch() on the returned Promise).
const stubRefreshSession = (pinia: ReturnType<typeof render>["pinia"]) => {
  const store = useAuthStore(pinia);
  vi.mocked(store.refreshSession).mockResolvedValue(undefined);
};

// ---------------------------------------------------------------------------
// useUser
// ---------------------------------------------------------------------------

describe("useUser", () => {
  it("returns undefined when no user is in auth store", () => {
    const Harness = defineComponent({
      setup() {
        const user = useUser();
        return { user };
      },
      template: `<div>{{ user ? user.name : 'no-user' }}</div>`,
    });

    const rendered = render(Harness);
    expect(rendered.getByText("no-user")).toBeInTheDocument();
  });

  it("returns mapped user when auth store has a session user", () => {
    const Harness = defineComponent({
      setup() {
        const auth = useAuthStore();
        // @ts-expect-error overwriting readonly for test
        auth.user = {
          id: "u-1",
          email: "alice@test.com",
          name: "Alice",
          image: "https://img.test/alice.jpg",
          createdAt: new Date(),
          updatedAt: new Date(),
          emailVerified: true,
        };
        const user = useUser();
        return { user };
      },
      template: `<div>{{ user ? user.name : 'no-user' }}</div>`,
    });

    const rendered = render(Harness);
    expect(rendered.getByText("Alice")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useUserClubs
// ---------------------------------------------------------------------------

describe("useUserClubs", () => {
  it("does not fetch clubs when user is not logged in", async () => {
    server.use(
      http.get("/api/member/clubs", () => {
        throw new Error("A logged-out user has no clubs to fetch");
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { status, fetchStatus } = useUserClubs();
        return { status, fetchStatus };
      },
      template: `<div>{{ status }}/{{ fetchStatus }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("loading/idle");
  });
});

// ---------------------------------------------------------------------------
// useUpdateName
// ---------------------------------------------------------------------------

describe("useUpdateName", () => {
  it("sends the new name to the profile endpoint", async () => {
    server.use(
      http.put("/api/member/name", async ({ request }) => {
        const { name } = (await request.json()) as { name?: string };
        return HttpResponse.json({ storedName: name ?? "none" });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, data } = useUpdateName();
        return { mutate, data };
      },
      template: `<button @click="() => mutate('Bob')">{{ data?.data.storedName ?? 'go' }}</button>`,
    });

    const rendered = render(Harness);
    stubRefreshSession(rendered.pinia);
    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "Bob" });
  });
});

// ---------------------------------------------------------------------------
// useUpdateAvatar
// ---------------------------------------------------------------------------

describe("useUpdateAvatar", () => {
  it("uploads the chosen file", async () => {
    server.use(
      http.post("/api/member/avatar", async ({ request }) => {
        const file = (await request.formData()).get("file");
        return HttpResponse.json({
          uploaded: file === null || typeof file === "string" ? "nothing" : await file.text(),
        });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, data } = useUpdateAvatar();
        const submit = () => {
          const fd = new FormData();
          fd.append("file", new Blob(["poster-bytes"], { type: "image/png" }), "avatar.png");
          mutate(fd);
        };
        return { submit, data };
      },
      template: `<button @click="submit">{{ data?.data.uploaded ?? 'go' }}</button>`,
    });

    const rendered = render(Harness);
    stubRefreshSession(rendered.pinia);
    rendered.getByRole("button").click();

    await rendered.findByRole("button", { name: "poster-bytes" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteAvatar
// ---------------------------------------------------------------------------

describe("useDeleteAvatar", () => {
  it("reports success once the avatar is gone", async () => {
    server.use(http.delete("/api/member/avatar", () => new HttpResponse(null, { status: 200 })));

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteAvatar();
        return { mutate, isSuccess };
      },
      template: `<button @click="mutate()">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const rendered = render(Harness);
    stubRefreshSession(rendered.pinia);
    rendered.getByRole("button").click();

    await rendered.findByText("done");
  });
});
