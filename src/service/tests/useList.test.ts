import { http, HttpResponse } from "msw";
import { ref } from "vue";

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
  useUpdateAddedDate,
} from "../useList";
import { WorkType } from "@/../lib/types/generated/db";
import { server } from "@/mocks/server";
import { withSetup } from "@/tests/utils";

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

/** The titles of whatever a list/lists query is holding. */
function titles(query: { data: { value?: { title: string }[] } }) {
  return query.data.value?.map((entry) => entry.title);
}

// ---------------------------------------------------------------------------
// useList
// ---------------------------------------------------------------------------

describe("useList", () => {
  it("does not fetch when listId is empty string", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", () => {
        throw new Error("There is no list to fetch without an id");
      }),
    );

    const { result } = withSetup(() => useList("test-club", ""));

    await vi.waitFor(() => {
      expect(result.status.value).toBe("loading");
      expect(result.fetchStatus.value).toBe("idle");
    });
  });

  it("swaps to the other list when the listId ref changes", async () => {
    server.use(
      http.get("/api/club/:id/list/:listId", ({ params }) =>
        HttpResponse.json([
          item(`item-of-${String(params.listId)}`, `Item of ${String(params.listId)}`),
        ]),
      ),
    );

    const listId = ref("list-a");
    const { result } = withSetup(() => useList("test-club", listId));

    await vi.waitFor(() => {
      expect(titles(result)).toEqual(["Item of list-a"]);
    });

    listId.value = "list-b";

    await vi.waitFor(() => {
      expect(titles(result)).toEqual(["Item of list-b"]);
    });
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
            ...item("item-1", "Dune"),
            sourceListId: "list-1",
            sourceListTitle: "Watchlist",
          },
          {
            ...item("item-2", "Solaris"),
            sourceListId: "list-2",
            sourceListTitle: "Backlog",
          },
        ]),
      ),
    );

    const { result } = withSetup(() => useAllUserListItems("test-club"));

    await vi.waitFor(() => {
      expect(result.data.value?.map((i) => [i.title, i.sourceListTitle])).toEqual([
        ["Dune", "Watchlist"],
        ["Solaris", "Backlog"],
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// useCreateList
// ---------------------------------------------------------------------------

describe("useCreateList", () => {
  it("adds the new list to the club's lists", async () => {
    server.use(...listsApi([list("list-1", "Watch List")]));

    const { result } = withSetup(() => ({
      lists: useClubLists("test-club"),
      create: useCreateList("test-club"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.lists)).toEqual(["Watch List"]);
    });

    result.create.mutate("Top Picks");

    await vi.waitFor(() => {
      expect(titles(result.lists)).toEqual(["Watch List", "Top Picks"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useDeleteList
// ---------------------------------------------------------------------------

describe("useDeleteList", () => {
  it("removes only the list it names", async () => {
    server.use(...listsApi([list("list-77", "Doomed"), list("list-2", "Keeper")]));

    const { result } = withSetup(() => ({
      lists: useClubLists("test-club"),
      remove: useDeleteList("test-club"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.lists)).toEqual(["Doomed", "Keeper"]);
    });

    result.remove.mutate("list-77");

    await vi.waitFor(() => {
      expect(titles(result.lists)).toEqual(["Keeper"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useAddListItem (optimistic)
// ---------------------------------------------------------------------------

describe("useAddListItem", () => {
  it("puts the work on the list", async () => {
    server.use(...listsApi([list("list-1", "Watch List")]));

    const { result } = withSetup(() => ({
      items: useList("test-club", "list-1"),
      add: useAddListItem("test-club", "list-1"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual([]);
    });

    result.add.mutate({
      type: WorkType.movie,
      title: "Blade Runner",
      externalId: "78",
      imageUrl: "https://img.test/br.jpg",
    });

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Blade Runner"]);
    });
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

    const { result } = withSetup(() => ({
      items: useList("test-club", "list-1"),
      remove: useDeleteListItem("test-club", "list-1"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Doomed", "Keeper"]);
    });

    result.remove.mutate("work-99");

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Keeper"]);
    });
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

    const { result } = withSetup(() => ({
      items: useReviewsList("test-club"),
      remove: useDeleteReview("test-club"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Doomed", "Keeper"]);
    });

    result.remove.mutate({ workId: "w-1", reviewsListId: "rev-list" });

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Keeper"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useReorderList (optimistic reorder)
// ---------------------------------------------------------------------------

describe("useReorderList", () => {
  it("stores the order the caller asked for", async () => {
    server.use(
      ...listsApi([list("list-1", "Watch List", [item("a", "Alien"), item("b", "Barbie")])]),
    );

    const { result } = withSetup(() => ({
      items: useList("test-club", "list-1"),
      reorder: useReorderList("test-club", "list-1"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Alien", "Barbie"]);
    });

    result.reorder.mutate(["b", "a"]);

    await vi.waitFor(() => {
      expect(titles(result.items)).toEqual(["Barbie", "Alien"]);
    });
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

    const { result } = withSetup(() => ({
      source: useList("test-club", "list-src"),
      destination: useList("test-club", "list-dst"),
      move: useMoveListItem("test-club"),
    }));

    await vi.waitFor(() => {
      expect(titles(result.source)).toEqual(["Solaris"]);
      expect(titles(result.destination)).toEqual([]);
    });

    result.move.mutate({
      sourceListId: "list-src",
      destinationListId: "list-dst",
      workId: "work-5",
    });

    await vi.waitFor(() => {
      expect(titles(result.source)).toEqual([]);
      expect(titles(result.destination)).toEqual(["Solaris"]);
    });
  });
});

// ---------------------------------------------------------------------------
// useUpdateAddedDate (optimistic date update)
// ---------------------------------------------------------------------------

describe("useUpdateAddedDate", () => {
  it("backdates the work on the reviews list", async () => {
    server.use(...listsApi([list("rev-list", "Reviews", [item("work-7", "Nope")])]));

    const { result } = withSetup(() => ({
      items: useReviewsList("test-club"),
      backdate: useUpdateAddedDate("test-club"),
    }));

    await vi.waitFor(() => {
      expect(result.items.data.value?.[0]?.createdDate).toBe("2024-01-01T00:00:00.000Z");
    });

    result.backdate.mutate({
      listId: "rev-list",
      workId: "work-7",
      addedDate: "2023-06-15T00:00:00.000Z",
    });

    await vi.waitFor(() => {
      expect(result.items.data.value?.[0]?.createdDate).toBe("2023-06-15T00:00:00.000Z");
    });
  });
});
