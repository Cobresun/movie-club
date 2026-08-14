import { http, HttpResponse } from "msw";
import { defineComponent, ref } from "vue";

import {
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

/** Renders a query's titles as text, so a list's contents and order show. */
const TITLES = `{{ lists?.map((l) => l.title).join(', ') || 'empty' }}`;
const ITEMS = `{{ items?.map((i) => i.title).join(', ') || 'empty' }}`;

function item(id: string, title: string) {
  return { id, title, type: "movie", createdDate: "2024-01-01T00:00:00.000Z" };
}

function list(id: string, title: string, items: ReturnType<typeof item>[] = []) {
  return { id, title, items };
}

/**
 * A fake club-lists API that keeps what the mutations send it, so each one is
 * checked by reading the list back the way a client does.
 */
function listsApi(initial: ReturnType<typeof list>[]) {
  let lists = initial.map((entry) => ({ ...entry, items: [...entry.items] }));
  const find = (id: unknown) => lists.find((entry) => entry.id === String(id));
  const summaries = () =>
    lists.map(({ id, title, items }) => ({
      id,
      title,
      systemType: id === "rev-list" ? "reviews" : null,
      itemCount: items.length,
    }));
  const ok = () => new HttpResponse(null, { status: 200 });

  return [
    http.get("/api/club/:id/list", () => HttpResponse.json(summaries())),
    http.get("/api/club/:id/list/reviews", () => HttpResponse.json(find("rev-list")?.items ?? [])),
    http.get("/api/club/:id/list/:listId", ({ params }) =>
      HttpResponse.json(find(params.listId)?.items ?? []),
    ),
    http.post("/api/club/:id/list", async ({ request }) => {
      const { title } = (await request.json()) as { title: string };
      const created = list(`list-${lists.length + 1}`, title);
      lists = [...lists, created];
      return HttpResponse.json({ ...created, systemType: null, itemCount: 0 });
    }),
    http.delete("/api/club/:id/list/:listId", ({ params }) => {
      lists = lists.filter((entry) => entry.id !== String(params.listId));
      return ok();
    }),
    http.post("/api/club/:id/list/:listId/items", async ({ request, params }) => {
      const { title } = (await request.json()) as { title: string };
      const target = find(params.listId);
      target?.items.push(item(`work-${(target.items.length + 1).toString()}`, title));
      return ok();
    }),
    http.post("/api/club/:id/list/:listId/items/:workId/move", async ({ request, params }) => {
      const { destinationListId } = (await request.json()) as { destinationListId: string };
      const source = find(params.listId);
      const moved = source?.items.find((entry) => entry.id === String(params.workId));
      if (!source || !moved) return new HttpResponse(null, { status: 404 });
      source.items = source.items.filter((entry) => entry.id !== moved.id);
      find(destinationListId)?.items.push(moved);
      return ok();
    }),
    http.delete("/api/club/:id/list/:listId/items/:workId", ({ params }) => {
      const target = find(params.listId);
      if (target) {
        target.items = target.items.filter((entry) => entry.id !== String(params.workId));
      }
      return ok();
    }),
    http.put("/api/club/:id/list/:listId/reorder", async ({ request, params }) => {
      const { workIds } = (await request.json()) as { workIds: string[] };
      const target = find(params.listId);
      if (target) {
        target.items = workIds.flatMap(
          (workId) => target.items.find((entry) => entry.id === workId) ?? [],
        );
      }
      return ok();
    }),
    http.put("/api/club/:id/list/:listId/items/:workId/added-date", async ({ request, params }) => {
      const { addedDate } = (await request.json()) as { addedDate: string };
      const target = find(params.listId);
      const entry = target?.items.find((candidate) => candidate.id === String(params.workId));
      if (entry) entry.createdDate = addedDate;
      return ok();
    }),
  ];
}

// ---------------------------------------------------------------------------
// useClubLists
// ---------------------------------------------------------------------------

describe("useClubLists", () => {
  it("loads the lists of the club the slug names", async () => {
    server.use(
      http.get("/api/club/:id/list", ({ params }) =>
        HttpResponse.json([
          { id: "1", title: `Watch List of ${String(params.id)}`, systemType: null, itemCount: 3 },
          { id: "2", title: "Backlog", systemType: null, itemCount: 1 },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useClubLists("test-club");
        return { data, isSuccess };
      },
      template: `<div v-if="isSuccess">{{ data?.map((l) => l.title).join(", ") }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Watch List of test-club, Backlog");
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

    const rendered = render(Harness);
    await rendered.findByText("reviews-list-123");
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

    const rendered = render(Harness);
    await rendered.findByText("The Matrix");
  });

  it("does not fetch when listId is empty string", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () => {
        throw new Error("There is no list to fetch without an id");
      }),
    );

    const Harness = defineComponent({
      setup() {
        const { status, fetchStatus } = useList("test-club", "");
        return { status, fetchStatus };
      },
      template: `<div>{{ status }}/{{ fetchStatus }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("loading/idle");
  });

  it("swaps to the other list when the listId ref changes", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", ({ params }) =>
        HttpResponse.json([
          {
            id: `item-of-${String(params.listId)}`,
            title: `Item of ${String(params.listId)}`,
            type: "movie",
            createdDate: "2024-01-01T00:00:00.000Z",
          },
        ]),
      ),
    );

    const listIdRef = ref("list-a");

    const Harness = defineComponent({
      setup() {
        const { data } = useList("test-club", listIdRef);
        return { data };
      },
      template: `<div>{{ data?.[0]?.title ?? 'loading' }}</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Item of list-a");

    listIdRef.value = "list-b";

    await rendered.findByText("Item of list-b");
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

    const rendered = render(Harness);
    await rendered.findByText("Inception");
  });
});

// ---------------------------------------------------------------------------
// useAllUserListItems
// ---------------------------------------------------------------------------

describe("useAllUserListItems", () => {
  it("returns every list's items in one request, tagged with their source list", async () => {
    server.use(
      // #421 replaced the per-list fan-out with a single aggregated endpoint.
      http.get("/api/club/:id/list/all-items", () =>
        HttpResponse.json([
          {
            id: "item-1",
            title: "Dune",
            type: "movie",
            createdDate: "2024-03-01T00:00:00.000Z",
            sourceListId: "list-1",
            sourceListTitle: "Watchlist",
          },
          {
            id: "item-2",
            title: "Solaris",
            type: "movie",
            createdDate: "2024-03-02T00:00:00.000Z",
            sourceListId: "list-2",
            sourceListTitle: "Backlog",
          },
        ]),
      ),
    );

    const Harness = defineComponent({
      setup() {
        const { data, isSuccess } = useAllUserListItems("test-club");
        return { data, isSuccess };
      },
      template: `<ul v-if="isSuccess"><li v-for="i in data" :key="i.id">{{ i.title }} — {{ i.sourceListTitle }}</li></ul><div v-else>loading</div>`,
    });

    const rendered = render(Harness);
    await rendered.findByText("Dune — Watchlist");
    expect(rendered.getByText("Solaris — Backlog")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useCreateList
// ---------------------------------------------------------------------------

describe("useCreateList", () => {
  it("adds the new list to the club's lists", async () => {
    server.use(...listsApi([list("list-1", "Watch List")]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useCreateList("test-club");
        const { data: lists } = useClubLists("test-club");
        return { mutate, lists };
      },
      template: `<button @click="() => mutate('Top Picks')">${TITLES}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Watch List" });

    button.click();

    await rendered.findByRole("button", { name: "Watch List, Top Picks" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteList
// ---------------------------------------------------------------------------

describe("useDeleteList", () => {
  it("removes only the list it names", async () => {
    server.use(...listsApi([list("list-77", "Doomed"), list("list-2", "Keeper")]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useDeleteList("test-club");
        const { data: lists } = useClubLists("test-club");
        return { mutate, lists };
      },
      template: `<button @click="() => mutate('list-77')">${TITLES}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Doomed, Keeper" });

    button.click();

    await rendered.findByRole("button", { name: "Keeper" });
  });
});

// ---------------------------------------------------------------------------
// useAddListItem (optimistic)
// ---------------------------------------------------------------------------

describe("useAddListItem", () => {
  it("puts the work on the list", async () => {
    server.use(...listsApi([list("list-1", "Watch List")]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useAddListItem("test-club", "list-1");
        const { data: items } = useList("test-club", "list-1");
        const payload = {
          type: "movie" as const,
          title: "Blade Runner",
          externalId: "78",
          imageUrl: "https://img.test/br.jpg",
        };
        return { mutate, items, payload };
      },
      template: `<button @click="() => mutate(payload)">${ITEMS}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "empty" });

    button.click();

    await rendered.findByRole("button", { name: "Blade Runner" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteListItem (optimistic removal)
// ---------------------------------------------------------------------------

describe("useDeleteListItem", () => {
  it("takes only the named work off the list", async () => {
    server.use(
      ...listsApi([
        list("list-1", "Watch List", [item("work-99", "Doomed"), item("work-2", "Keeper")]),
      ]),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate } = useDeleteListItem("test-club", "list-1");
        const { data: items } = useList("test-club", "list-1");
        return { mutate, items };
      },
      template: `<button @click="() => mutate('work-99')">${ITEMS}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Doomed, Keeper" });

    button.click();

    await rendered.findByRole("button", { name: "Keeper" });
  });
});

// ---------------------------------------------------------------------------
// useDeleteReview (reviews list)
// ---------------------------------------------------------------------------

describe("useDeleteReview", () => {
  it("takes the work off the reviews list", async () => {
    server.use(
      ...listsApi([list("rev-list", "Reviews", [item("w-1", "Doomed"), item("w-2", "Keeper")])]),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate } = useDeleteReview("test-club");
        const { data: items } = useReviewsList("test-club");
        return { mutate, items };
      },
      template: `<button @click="() => mutate({ workId: 'w-1', reviewsListId: 'rev-list' })">${ITEMS}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Doomed, Keeper" });

    button.click();

    await rendered.findByRole("button", { name: "Keeper" });
  });
});

// ---------------------------------------------------------------------------
// useReorderList (optimistic reorder + rollback)
// ---------------------------------------------------------------------------

describe("useReorderList", () => {
  it("stores the order the caller asked for", async () => {
    server.use(
      ...listsApi([list("list-1", "Watch List", [item("a", "Alien"), item("b", "Barbie")])]),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate } = useReorderList("test-club", "list-1");
        const { data: items } = useList("test-club", "list-1");
        return { mutate, items };
      },
      template: `<button @click="() => mutate(['b', 'a'])">${ITEMS}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Alien, Barbie" });

    button.click();

    await rendered.findByRole("button", { name: "Barbie, Alien" });
  });
});

// ---------------------------------------------------------------------------
// useMoveListItem (cross-list optimistic move)
// ---------------------------------------------------------------------------

describe("useMoveListItem", () => {
  it("moves the work to the destination list", async () => {
    server.use(
      ...listsApi([
        list("list-src", "Source", [item("work-5", "Solaris")]),
        list("list-dst", "Destination"),
      ]),
    );

    const Harness = defineComponent({
      setup() {
        const { mutate } = useMoveListItem("test-club");
        const { data: source } = useList("test-club", "list-src");
        const { data: destination } = useList("test-club", "list-dst");
        const payload = {
          sourceListId: "list-src",
          destinationListId: "list-dst",
          workId: "work-5",
        };
        return { mutate, source, destination, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ (source ?? []).map((i) => i.title).join() || 'empty' }} -> {{ (destination ?? []).map((i) => i.title).join() || 'empty' }}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "Solaris -> empty" });

    button.click();

    await rendered.findByRole("button", { name: "empty -> Solaris" });
  });
});

// ---------------------------------------------------------------------------
// useUpdateAddedDate (optimistic date update)
// ---------------------------------------------------------------------------

describe("useUpdateAddedDate", () => {
  it("backdates the work on the reviews list", async () => {
    server.use(...listsApi([list("rev-list", "Reviews", [item("work-7", "Nope")])]));

    const Harness = defineComponent({
      setup() {
        const { mutate } = useUpdateAddedDate("test-club");
        const { data: items } = useReviewsList("test-club");
        const payload = {
          listId: "rev-list",
          workId: "work-7",
          addedDate: "2023-06-15T00:00:00.000Z",
        };
        return { mutate, items, payload };
      },
      template: `<button @click="() => mutate(payload)">{{ items?.[0]?.createdDate ?? 'loading' }}</button>`,
    });

    const rendered = render(Harness);
    const button = await rendered.findByRole("button", { name: "2024-01-01T00:00:00.000Z" });

    button.click();

    await rendered.findByRole("button", { name: "2023-06-15T00:00:00.000Z" });
  });
});
