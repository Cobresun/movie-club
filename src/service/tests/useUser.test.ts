import { http, HttpResponse } from "msw";
import { defineComponent } from "vue";

import {
  useDeleteAvatar,
  useUpdateAvatar,
  useUpdateName,
  useUser,
  useUserClubs,
} from "../useUser";

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

    const { getByText } = render(Harness);
    expect(getByText("no-user")).toBeInTheDocument();
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

    const { getByText, pinia } = render(Harness);
    // Access pinia to ensure auth store is registered
    void pinia;
    expect(getByText("Alice")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useUserClubs
// ---------------------------------------------------------------------------

describe("useUserClubs", () => {
  it("does not fetch clubs when user is not logged in", async () => {
    let fetchCalled = false;
    server.use(
      http.get("/api/member/clubs", () => {
        fetchCalled = true;
        return HttpResponse.json([]);
      }),
    );

    const Harness = defineComponent({
      setup() {
        // isLoggedIn is false by default in test pinia
        const { isLoading } = useUserClubs();
        return { isLoading };
      },
      template: `<div>{{ isLoading ? 'loading' : 'idle' }}</div>`,
    });

    render(Harness);
    await new Promise((r) => setTimeout(r, 50));
    // The global setup renders PiniaStoreHelper which also runs useUserClubs
    // via the auth store; but since isLoggedIn=false it should not fetch.
    expect(fetchCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useUpdateName
// ---------------------------------------------------------------------------

describe("useUpdateName", () => {
  it("PUTs new name to /api/member/name", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put("/api/member/name", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useUpdateName();
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('Bob')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText, pinia } = render(Harness);
    stubRefreshSession(pinia);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ name: "Bob" });
  });
});

// ---------------------------------------------------------------------------
// useUpdateAvatar
// ---------------------------------------------------------------------------

describe("useUpdateAvatar", () => {
  it("POSTs FormData to /api/member/avatar", async () => {
    let receivedRequest = false;
    server.use(
      http.post("/api/member/avatar", () => {
        receivedRequest = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useUpdateAvatar();
        const submit = () => {
          const fd = new FormData();
          fd.append(
            "file",
            new Blob(["img"], { type: "image/png" }),
            "avatar.png",
          );
          mutate(fd);
        };
        return { submit, isSuccess };
      },
      template: `<button @click="submit">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText, pinia } = render(Harness);
    stubRefreshSession(pinia);
    getByRole("button").click();
    await findByText("done");
    expect(receivedRequest).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useDeleteAvatar
// ---------------------------------------------------------------------------

describe("useDeleteAvatar", () => {
  it("DELETEs avatar at /api/member/avatar", async () => {
    let deleteCalled = false;
    server.use(
      http.delete("/api/member/avatar", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteAvatar();
        return { mutate, isSuccess };
      },
      template: `<button @click="mutate()">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText, pinia } = render(Harness);
    stubRefreshSession(pinia);
    getByRole("button").click();
    await findByText("done");
    expect(deleteCalled).toBe(true);
  });
});
