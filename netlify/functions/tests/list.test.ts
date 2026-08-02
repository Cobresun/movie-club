/**
 * Integration tests for `netlify/functions/club/list.ts`.
 *
 * Lists are where the schema's constraints do most of the work — positions,
 * the (list_id, work_id) unique index, the system-list partial index, the move
 * transaction — so these run against a real CockroachDB. Adding a work also
 * exercises the provider cache: the first add fetches TMDB (through MSW), later
 * ones must not.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ClubType, WorkListSystemType, WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem, DetailedWorkListItem } from "../../../lib/types/lists";
import { MovieDataSummary } from "../../../lib/types/movie";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import {
  addReviewedWork,
  addWork,
  createClub,
  createList,
  joinClub,
  leaveClub,
  scoreWork,
  setAddedDate,
} from "./helpers/factories";
import { requester } from "./helpers/http";
import { requestsTo, server } from "./setup/externalApis";

const api = requester(handler);

interface ListSummary {
  id: string;
  title: string;
  systemType: WorkListSystemType | null;
  itemCount: number;
}

const listsOf = (slug: string) => api.get<ListSummary[]>(`/api/club/${slug}/list`);
const itemsOf = (slug: string, listId: string) =>
  api.get<DetailedWorkListItem<MovieDataSummary>[]>(`/api/club/${slug}/list/${listId}`);

describe("GET /api/club/:clubSlug/list", () => {
  it("returns the club's user lists with their item counts", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const shortlist = await createList(club, alice, "Shortlist");
    await addWork(club, alice);

    const res = await listsOf(club.slug);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: club.listId, title: "Watch List", systemType: null, itemCount: 1 },
      { id: shortlist, title: "Shortlist", systemType: null, itemCount: 0 },
    ]);
  });

  it("never exposes the reviews system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await listsOf(club.slug);

    expect(res.body.map((list) => list.id)).not.toContain(club.reviewsListId);
  });
});

describe("GET /api/club/:clubSlug/list/reviews-id", () => {
  it("returns the id of the reviews system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.get<{ id: string }>(`/api/club/${club.slug}/list/reviews-id`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(club.reviewsListId);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.get(`/api/club/${club.slug}/list/reviews-id`, { as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/club/:clubSlug/list", () => {
  it("creates an empty list at the end of the club's ordering", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createList(club, alice, "Shortlist");

    const res = await api.post<ListSummary>(`/api/club/${club.slug}/list`, {
      body: { title: "Halloween" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ title: "Halloween", systemType: null, itemCount: 0 });
    const lists = await listsOf(club.slug);
    expect(lists.body.map((list) => list.title)).toEqual(["Watch List", "Shortlist", "Halloween"]);
  });

  it.each([
    ["no body", undefined],
    ["an empty title", { title: "" }],
    ["a title over 100 characters", { title: "x".repeat(101) }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/list`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.post(`/api/club/${club.slug}/list`, { body: { title: "X" }, as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/club/:clubSlug/list/reorder", () => {
  it("reassigns positions to the order given", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const second = await createList(club, alice, "Second");

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, {
      body: { listIds: [second, club.listId] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const lists = await listsOf(club.slug);
    expect(lists.body.map((list) => list.title)).toEqual(["Second", "Watch List"]);
  });

  it("rejects a payload that omits one of the club's lists", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await createList(club, alice, "Second");

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, {
      body: { listIds: [club.listId] },
      as: alice,
    });

    expect(res.statusCode).toBe(500);
    const lists = await listsOf(club.slug);
    expect(lists.body.map((list) => list.title)).toEqual(["Watch List", "Second"]);
  });

  it.each([
    ["no body", undefined],
    ["an empty listIds array", { listIds: [] }],
    ["malformed JSON", "{ not json"],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/list/:listId", () => {
  it("returns the list's items with their cached metadata, in the order they were added", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { title: "Star Wars", externalId: "11" });
    await addWork(club, alice, { title: "Untracked", externalId: null });

    const res = await itemsOf(club.slug, club.listId);

    expect(res.statusCode).toBe(200);
    expect(res.body.map((item) => item.title)).toEqual(["Star Wars", "Untracked"]);
    expect(res.body[0].externalData?.overview).toBe("Overview for movie 11");
    // The bulk payload omits cast lists; only `castNames` rides along.
    expect(res.body[0].externalData).not.toHaveProperty("actors");
    expect(res.body[0].externalData?.castNames).toEqual(["Lead 11", "Support 11"]);
    expect(res.body[1].externalData).toBeUndefined();
  });

  it("records who added an item and when", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const addedDate = new Date("2024-03-04T05:06:07.000Z");
    await addWork(club, bob, { externalId: null, addedDate });

    const res = await itemsOf(club.slug, club.listId);

    expect(res.body[0].addedBy).toBe(bob.userId);
    expect(res.body[0].createdDate).toBe(addedDate.toISOString());
  });

  it("returns 404 for a list belonging to another club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createClub(alice);

    const res = await api.get(`/api/club/${club.slug}/list/${other.listId}`);

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/club/:clubSlug/list/all-items", () => {
  it("returns every user list's items tagged with its source list, reviews excluded", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const shortlist = await createList(club, alice, "Shortlist");
    await addWork(club, alice, { title: "On Watch List", externalId: null });
    await addWork(club, alice, { title: "On Shortlist", externalId: null, listId: shortlist });
    await addReviewedWork(club, alice, { title: "Reviewed", externalId: null });

    const res = await api.get<(DetailedWorkListItem & { sourceListTitle: string })[]>(
      `/api/club/${club.slug}/list/all-items`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.map((item) => [item.title, item.sourceListTitle])).toEqual([
      ["On Watch List", "Watch List"],
      ["On Shortlist", "Shortlist"],
    ]);
  });
});

describe("PUT /api/club/:clubSlug/list/:listId", () => {
  it("renames a user list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}`, {
      body: { title: "Renamed" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const lists = await listsOf(club.slug);
    expect(lists.body[0].title).toBe("Renamed");
  });

  it("refuses to rename a system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put<{ error: string }>(
      `/api/club/${club.slug}/list/${club.reviewsListId}`,
      { body: { title: "Not Reviews" }, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Cannot rename a system list");
    // Still hidden from the collection, so nothing about it changed.
    const lists = await listsOf(club.slug);
    expect(lists.body.map((list) => list.title)).toEqual(["Watch List"]);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/club/:clubSlug/list/:listId", () => {
  it("deletes a user list and everything on it", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { externalId: null });

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}`, { as: alice });

    expect(res.statusCode).toBe(200);
    expect((await listsOf(club.slug)).body).toEqual([]);
    expect((await itemsOf(club.slug, club.listId)).statusCode).toBe(404);
  });

  it("refuses to delete a system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.delete<{ error: string }>(
      `/api/club/${club.slug}/list/${club.reviewsListId}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Cannot delete a system list");
    const reviews = await api.get<{ id: string }>(`/api/club/${club.slug}/list/reviews-id`, {
      as: alice,
    });
    expect(reviews.body.id).toBe(club.reviewsListId);
  });
});

describe("POST /api/club/:clubSlug/list/:listId/items", () => {
  it("creates the work, caches its TMDB metadata, and puts it on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
      body: { type: WorkType.movie, title: "Alien", externalId: "348", imageUrl: "/alien.jpg" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(requestsTo("api.themoviedb.org/3/movie/348")).toHaveLength(1);

    const items = await itemsOf(club.slug, club.listId);
    expect(items.body).toHaveLength(1);
    expect(items.body[0]).toMatchObject({
      title: "Alien",
      externalId: "348",
      imageUrl: "/alien.jpg",
      addedBy: alice.userId,
    });
    expect(items.body[0].externalData?.genres).toEqual(["Drama"]);
  });

  it("reuses the cached metadata rather than calling TMDB again", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createList(club, alice, "Other");

    await addWork(club, alice, { title: "Alien", externalId: "348" });
    await addWork(club, alice, { title: "Alien", externalId: "348", listId: other });

    expect(requestsTo("api.themoviedb.org/3/movie/348")).toHaveLength(1);
  });

  it("reuses the existing work when the same external id is added twice", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createList(club, alice, "Other");

    const first = await addWork(club, alice, { title: "Alien", externalId: "348" });
    const second = await addWork(club, alice, { title: "Alien", externalId: "348", listId: other });

    expect(second.id).toBe(first.id);
    const all = await api.get<DetailedWorkListItem[]>(`/api/club/${club.slug}/list/all-items`);
    expect(all.body.map((item) => item.id)).toEqual([first.id, first.id]);
  });

  it("rejects a work that is already on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const body = { type: WorkType.movie, title: "Alien", externalId: "348" };

    await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { body, as: alice });
    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items`,
      { body, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Item is already in list");
    expect((await itemsOf(club.slug, club.listId)).body).toHaveLength(1);
  });

  it("appends each new item after the last one", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    for (const externalId of ["1", "2", "3"]) {
      await addWork(club, alice, { title: `Movie ${externalId}`, externalId });
    }

    const items = await itemsOf(club.slug, club.listId);
    expect(items.body.map((item) => item.title)).toEqual(["Movie 1", "Movie 2", "Movie 3"]);
  });

  it("still adds the work when the metadata provider fails", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    server.use(
      http.get(
        "https://api.themoviedb.org/3/movie/:id",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
      body: { type: WorkType.movie, title: "Flaky", externalId: "999" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const items = await itemsOf(club.slug, club.listId);
    expect(items.body[0].title).toBe("Flaky");
    expect(items.body[0].externalData).toBeUndefined();
  });

  it("caches Google Books metadata for a book club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.book });

    await addWork(club, alice, { type: WorkType.book, title: "Dune", externalId: "voldune" });

    const items = await itemsOf(club.slug, club.listId);
    expect(items.body[0].externalData).toMatchObject({
      kind: "book",
      title: "Book voldune",
      authors: ["Author voldune"],
      firstPublishYear: 1998,
      numberOfPages: 321,
    });
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice] });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
      body: { type: WorkType.movie, title: "Alien", externalId: "348" },
      as: bob,
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/club/:clubSlug/list/:listId/items/:workId", () => {
  it("removes the item and deletes the now-orphaned work", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await itemsOf(club.slug, club.listId)).body).toEqual([]);
    expect((await api.get(`/api/club/${club.slug}/work/${work.id}/details`)).statusCode).toBe(404);
  });

  it("keeps the work when it is still on another list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createList(club, alice, "Other");
    const work = await addWork(club, alice, { title: "Kept", externalId: "77" });
    await addWork(club, alice, { title: "Kept", externalId: "77", listId: other });

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await itemsOf(club.slug, club.listId)).body).toEqual([]);
    expect((await itemsOf(club.slug, other)).body.map((item) => item.id)).toEqual([work.id]);
  });

  it("returns 400 when the work is not on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createList(club, alice, "Other");
    const work = await addWork(club, alice, { externalId: null, listId: other });

    const res = await api.delete<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This movie does not exist in the list");
  });
});

describe("PUT /api/club/:clubSlug/list/:listId/reorder", () => {
  it("reorders the given works into the slots they already occupied", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const works = [
      await addWork(club, alice, { title: "A", externalId: null }),
      await addWork(club, alice, { title: "B", externalId: null }),
      await addWork(club, alice, { title: "C", externalId: null }),
    ];

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}/reorder`, {
      body: { workIds: [works[2].id, works[0].id, works[1].id] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const items = await itemsOf(club.slug, club.listId);
    expect(items.body.map((item) => item.title)).toEqual(["C", "A", "B"]);
  });

  it("leaves works outside the payload in their own slots", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const works = [
      await addWork(club, alice, { title: "A", externalId: null }),
      await addWork(club, alice, { title: "B", externalId: null }),
      await addWork(club, alice, { title: "C", externalId: null }),
    ];

    await api.put(`/api/club/${club.slug}/list/${club.listId}/reorder`, {
      body: { workIds: [works[2].id, works[0].id] },
      as: alice,
    });

    const items = await itemsOf(club.slug, club.listId);
    expect(items.body.map((item) => item.title)).toEqual(["C", "B", "A"]);
  });

  it.each([
    ["no body", undefined],
    ["an empty workIds array", { workIds: [] }],
    ["malformed JSON", "}{"],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub(alice);

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}/reorder`, {
      body,
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/club/:clubSlug/list/:listId/items/:workId/added-date", () => {
  it("updates the item's added date", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.put(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/added-date`,
      { body: { addedDate: "2020-01-02T03:04:05.000Z" }, as: alice },
    );

    expect(res.statusCode).toBe(200);
    const items = await itemsOf(club.slug, club.listId);
    expect(items.body[0].createdDate).toBe("2020-01-02T03:04:05.000Z");
  });

  it("returns 400 for a date that is not an ISO datetime with an offset", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.put(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/added-date`,
      { body: { addedDate: "2020-01-02" }, as: alice },
    );

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when the work is not on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const other = await createList(club, alice, "Other");
    const work = await addWork(club, alice, { externalId: null, listId: other });

    const res = await api.put<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/added-date`,
      { body: { addedDate: "2020-01-02T03:04:05.000Z" }, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This work does not exist in the list");
  });
});

describe("POST /api/club/:clubSlug/list/:listId/items/:workId/move", () => {
  it("moves the work between lists, carrying its attribution forward", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const destination = await createList(club, alice, "Destination");
    const addedDate = new Date("2021-05-06T07:08:09.000Z");
    const work = await addWork(club, bob, { title: "Moved", externalId: null, addedDate });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      body: { destinationListId: destination },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect((await itemsOf(club.slug, club.listId)).body).toEqual([]);

    const moved = await itemsOf(club.slug, destination);
    expect(moved.body[0]).toMatchObject({
      title: "Moved",
      addedBy: bob.userId,
      createdDate: addedDate.toISOString(),
    });
  });

  it("stamps the current time when moving into the reviews list", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const longAgo = new Date("2015-01-01T00:00:00.000Z");
    const work = await addWork(club, alice, { externalId: null, addedDate: longAgo });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      body: { destinationListId: club.reviewsListId },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const reviewed = await itemsOf(club.slug, club.reviewsListId);
    expect(Date.parse(reviewed.body[0].createdDate)).toBeGreaterThan(longAgo.getTime());
  });

  it("returns 400 when the destination belongs to another club", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const otherClub = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`,
      { body: { destinationListId: otherClub.listId }, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Destination list not found");
    expect((await itemsOf(club.slug, club.listId)).body.map((item) => item.id)).toEqual([work.id]);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const work = await addWork(club, alice, { externalId: null });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/list/reviews", () => {
  it("returns each reviewed work with its per-member scores and average", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const work = await addReviewedWork(club, alice, { title: "Forrest Gump", externalId: "13" });
    await scoreWork(club, alice, work.id, 8);
    await scoreWork(club, bob, work.id, 6);

    const res = await api.get<DetailedReviewListItem<MovieDataSummary>[]>(
      `/api/club/${club.slug}/list/reviews`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Forrest Gump");
    expect(res.body[0].scores[alice.userId].score).toBe(8);
    expect(res.body[0].scores[bob.userId].score).toBe(6);
    expect(res.body[0].scores.average.score).toBe(7);
    expect(res.body[0].externalData?.overview).toBe("Overview for movie 13");
  });

  it("excludes the scores of members who have left the club", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const work = await addReviewedWork(club, alice, { externalId: null });
    await scoreWork(club, alice, work.id, 9);
    await scoreWork(club, bob, work.id, 1);

    await leaveClub(club, bob);

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(Object.keys(res.body[0].scores).sort()).toEqual([alice.userId, "average"].sort());
    expect(res.body[0].scores.average.score).toBe(9);
  });

  it("brings a returning member's score back with them", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    const club = await createClub(alice, { members: [alice, bob] });
    const work = await addReviewedWork(club, alice, { externalId: null });
    await scoreWork(club, bob, work.id, 4);

    await leaveClub(club, bob);
    await joinClub(club, bob);

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(res.body[0].scores[bob.userId].score).toBe(4);
  });

  it("returns an empty scores map for a work nobody has scored", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addReviewedWork(club, alice, { externalId: null });

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(res.body[0].scores).toEqual({});
  });

  it("returns the most recently added work first", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    const older = await addReviewedWork(club, alice, { title: "Older", externalId: null });
    const newer = await addReviewedWork(club, alice, { title: "Newer", externalId: null });
    await setAddedDate(club, alice, club.reviewsListId, older.id, new Date("2020-01-01T00:00:00Z"));
    await setAddedDate(club, alice, club.reviewsListId, newer.id, new Date("2024-01-01T00:00:00Z"));

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(res.body.map((item) => item.title)).toEqual(["Newer", "Older"]);
  });
});
