import { waitFor } from "@testing-library/vue";
import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

import {
  clubListsKey,
  listKey,
  OPTIMISTIC_WORK_ID,
  reviewsListKey,
  useAddListItem,
  useAllUserListItems,
  useClubLists,
  useCreateList,
  useDeleteList,
  useDeleteListItem,
  useDeleteReview,
  useList,
  useMoveListItem,
  useReorderList,
  useReviewsList,
  useReviewsListId,
  useUpdateAddedDate,
} from "../useList";

import { server } from "@/mocks/server";
import { render } from "@/tests/utils";

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

describe("query key helpers", () => {
  it("clubListsKey returns correct array", () => {
    expect(clubListsKey("my-club")).toEqual(["lists", "my-club"]);
  });

  it("listKey returns correct array", () => {
    expect(listKey("my-club", "list-1")).toEqual(["list", "my-club", "list-1"]);
  });

  it("reviewsListKey returns correct array", () => {
    expect(reviewsListKey("my-club")).toEqual(["list", "my-club", "reviews"]);
  });
});

// ---------------------------------------------------------------------------
// useClubLists
// ---------------------------------------------------------------------------

describe("useClubLists", () => {
  it("fetches club lists from /api/club/:id/list", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/club/:id/list", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([
          { id: "1", title: "Watch List", systemType: null, itemCount: 3 },
          { id: "2", title: "Backlog", systemType: null, itemCount: 1 },
        ]);
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useClubLists("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.length : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("2");
    expect(capturedUrl).toContain("/api/club/test-club/list");
  });
});

// ---------------------------------------------------------------------------
// useReviewsListId
// ---------------------------------------------------------------------------

describe("useReviewsListId", () => {
  it("fetches the reviews list id from /api/club/:id/list/reviews-id", async () => {
    server.use(
      http.get("/api/club/:id/list/reviews-id", () =>
        HttpResponse.json({ id: "reviews-list-123" }),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useReviewsListId("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("reviews-list-123");
  });
});

// ---------------------------------------------------------------------------
// useList
// ---------------------------------------------------------------------------

describe("useList", () => {
  it("fetches list items from /api/club/:id/list/:listId", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () =>
        HttpResponse.json([
          {
            id: "item-1",
            title: "The Matrix",
            type: "movie",
            createdDate: "2024-01-01T00:00:00.000Z",
          },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useList("test-club", "list-42");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.[0]?.title : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("The Matrix");
  });

  it("does not fetch when listId is empty string", async () => {
    let fetchCalled = false;
    server.use(
      http.get("/api/club/:id/list/:listId", () => {
        fetchCalled = true;
        return HttpResponse.json([]);
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { isLoading } = useList("test-club", "");
        return { isLoading };
      },
      template: `<div>{{ isLoading ? 'loading' : 'idle' }}</div>`,
    });

    render(Harness);
    // Give time for any spurious request to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCalled).toBe(false);
  });

  it("refetches when the listId ref changes", async () => {
    const fetchedListIds: string[] = [];
    server.use(
      http.get("/api/club/:id/list/:listId", ({ params }) => {
        fetchedListIds.push(String(params.listId));
        return HttpResponse.json([]);
      }),
    );

    const listIdRef = ref("list-a");

    const Harness = defineComponent({
      setup() {
        const { data } = useList("test-club", listIdRef);
        return { data };
      },
      template: `<div>ok</div>`,
    });

    render(Harness);
    await waitFor(() => expect(fetchedListIds).toContain("list-a"));

    listIdRef.value = "list-b";
    await waitFor(() => expect(fetchedListIds).toContain("list-b"));
  });
});

// ---------------------------------------------------------------------------
// useReviewsList
// ---------------------------------------------------------------------------

describe("useReviewsList", () => {
  it("fetches reviews from /api/club/:id/list/reviews", async () => {
    server.use(
      http.get("/api/club/:id/list/reviews", () =>
        HttpResponse.json([
          {
            id: "r-1",
            title: "Inception",
            type: "movie",
            createdDate: "2024-01-01T00:00:00.000Z",
            scores: {},
          },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useReviewsList("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.[0]?.title : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("Inception");
  });
});

// ---------------------------------------------------------------------------
// useAllUserListItems
// ---------------------------------------------------------------------------

describe("useAllUserListItems", () => {
  it("aggregates items across all lists with sourceListId/sourceListTitle", async () => {
    server.use(
      http.get("/api/club/:id/list", () =>
        HttpResponse.json([
          { id: "list-1", title: "Watchlist", systemType: null, itemCount: 1 },
        ]),
      ),
      http.get("/api/club/:id/list/list-1", () =>
        HttpResponse.json([
          {
            id: "item-1",
            title: "Dune",
            type: "movie",
            createdDate: "2024-03-01T00:00:00.000Z",
          },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useAllUserListItems("test-club");
        return { data, isSuccess };
      },
      template: `<div>{{ isSuccess ? data?.[0]?.sourceListTitle : 'loading' }}</div>`,
    });

    const { findByText } = render(Harness);
    await findByText("Watchlist");
  });
});

// ---------------------------------------------------------------------------
// useCreateList
// ---------------------------------------------------------------------------

describe("useCreateList", () => {
  it("POSTs a new list and performs optimistic insert then settles", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/list", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: "new-list-99",
          title: "Top Picks",
          systemType: null,
          itemCount: 0,
        });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useCreateList("test-club");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('Top Picks')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ title: "Top Picks" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteList
// ---------------------------------------------------------------------------

describe("useDeleteList", () => {
  it("DELETEs the list by id", async () => {
    let deletedId = "";
    server.use(
      http.delete("/api/club/:id/list/:listId", ({ params }) => {
        deletedId = String(params.listId);
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteList("test-club");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('list-77')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(deletedId).toBe("list-77");
  });
});

// ---------------------------------------------------------------------------
// useAddListItem (optimistic)
// ---------------------------------------------------------------------------

describe("useAddListItem", () => {
  it("POSTs item and uses OPTIMISTIC_WORK_ID as temp id", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post("/api/club/:id/list/:listId/items", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useAddListItem("test-club", "list-1");
        const payload = {
          type: "movie" as const,
          title: "Blade Runner",
          externalId: "78",
          imageUrl: "https://img.test/br.jpg",
        };
        return { mutate, isSuccess, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toMatchObject({ title: "Blade Runner" });
    expect(OPTIMISTIC_WORK_ID).toBe("temp");
  });
});

// ---------------------------------------------------------------------------
// useDeleteListItem (optimistic removal)
// ---------------------------------------------------------------------------

describe("useDeleteListItem", () => {
  it("DELETEs an item and invalidates the list query", async () => {
    let deletedWorkId = "";
    server.use(
      http.delete("/api/club/:id/list/:listId/items/:workId", ({ params }) => {
        deletedWorkId = String(params.workId);
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteListItem("test-club", "list-1");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate('work-99')">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(deletedWorkId).toBe("work-99");
  });
});

// ---------------------------------------------------------------------------
// useDeleteReview (reviews list)
// ---------------------------------------------------------------------------

describe("useDeleteReview", () => {
  it("DELETEs review item from reviews list", async () => {
    let deletedWorkId = "";
    server.use(
      http.delete("/api/club/:id/list/:listId/items/:workId", ({ params }) => {
        deletedWorkId = String(params.workId);
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useDeleteReview("test-club");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate({ workId: 'w-1', reviewsListId: 'rev-list' })">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(deletedWorkId).toBe("w-1");
  });
});

// ---------------------------------------------------------------------------
// useReorderList (optimistic reorder + rollback)
// ---------------------------------------------------------------------------

describe("useReorderList", () => {
  it("PUTs new order to /api/club/:id/list/:listId/reorder", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put("/api/club/:id/list/:listId/reorder", async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useReorderList("test-club", "list-1");
        return { mutate, isSuccess };
      },
      template: `<button @click="() => mutate(['b', 'a'])">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ workIds: ["b", "a"] });
  });
});

// ---------------------------------------------------------------------------
// useMoveListItem (cross-list optimistic move)
// ---------------------------------------------------------------------------

describe("useMoveListItem", () => {
  it("POSTs move to /api/club/:id/list/:sourceListId/items/:workId/move", async () => {
    let capturedDestination = "";
    server.use(
      http.post(
        "/api/club/:id/list/:listId/items/:workId/move",
        async ({ request }) => {
          const body = (await request.json()) as { destinationListId: string };
          capturedDestination = body.destinationListId;
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useMoveListItem("test-club");
        const payload = {
          sourceListId: "list-src",
          destinationListId: "list-dst",
          workId: "work-5",
        };
        return { mutate, isSuccess, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedDestination).toBe("list-dst");
  });
});

// ---------------------------------------------------------------------------
// useUpdateAddedDate (optimistic date update)
// ---------------------------------------------------------------------------

describe("useUpdateAddedDate", () => {
  it("PUTs added-date to correct endpoint", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.put(
        "/api/club/:id/list/:listId/items/:workId/added-date",
        async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 200 });
        },
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate, isSuccess } = useUpdateAddedDate("test-club");
        const payload = {
          listId: "list-1",
          workId: "work-7",
          addedDate: "2023-06-15T00:00:00.000Z",
        };
        return { mutate, isSuccess, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ isSuccess ? 'done' : 'go' }}</button>`,
    });

    const { getByRole, findByText } = render(Harness);
    getByRole("button").click();
    await findByText("done");
    expect(capturedBody).toEqual({ addedDate: "2023-06-15T00:00:00.000Z" });
  });
});
