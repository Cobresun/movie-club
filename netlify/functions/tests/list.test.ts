/**
 * Integration tests for `netlify/functions/club/list.ts`.
 *
 * Lists are where the schema's constraints do most of the work — positions,
 * the (list_id, work_id) unique index, the system-list partial index, the move
 * transaction — so these run against a real CockroachDB rather than a stubbed
 * repository. Adding a work also exercises the provider cache: the first add
 * fetches TMDB (through MSW), later ones must not.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ClubType, WorkListSystemType, WorkType } from "../../../lib/types/generated/db";
import { DetailedReviewListItem, DetailedWorkListItem } from "../../../lib/types/lists";
import { MovieDataSummary } from "../../../lib/types/movie";
import { handler } from "../club/index";
import { signIn } from "./helpers/auth";
import { db } from "./helpers/database";
import {
  addMember,
  addToList,
  cacheMovieDetails,
  createClub,
  createList,
  createReview,
  createReviewedWork,
  createUser,
  createWork,
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

describe("GET /api/club/:clubSlug/list", () => {
  it("returns the club's user lists with their item counts", async () => {
    const club = await createClub();
    const shortlist = await createList(club.id, "Shortlist", 2);
    const work = await createWork(club.id);
    await addToList(club.listId, work.id);

    const res = await api.get<ListSummary[]>(`/api/club/${club.slug}/list`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { id: club.listId, title: "Watch List", systemType: null, itemCount: 1 },
      { id: shortlist, title: "Shortlist", systemType: null, itemCount: 0 },
    ]);
  });

  it("never exposes the reviews system list", async () => {
    const club = await createClub();

    const res = await api.get<ListSummary[]>(`/api/club/${club.slug}/list`);

    expect(res.body.map((list) => list.id)).not.toContain(club.reviewsListId);
  });

  it("orders lists by position", async () => {
    const club = await createClub();
    await createList(club.id, "Third", 4);
    await createList(club.id, "Second", 3);

    const res = await api.get<ListSummary[]>(`/api/club/${club.slug}/list`);

    expect(res.body.map((list) => list.title)).toEqual(["Watch List", "Second", "Third"]);
  });
});

describe("GET /api/club/:clubSlug/list/reviews-id", () => {
  it("returns the id of the reviews system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.get<{ id: string }>(`/api/club/${club.slug}/list/reviews-id`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(club.reviewsListId);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();

    const res = await api.get(`/api/club/${club.slug}/list/reviews-id`, { as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/club/:clubSlug/list", () => {
  it("creates a list at the end of the club's ordering", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post<ListSummary>(`/api/club/${club.slug}/list`, {
      body: { title: "Halloween" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ title: "Halloween", systemType: null, itemCount: 0 });

    const row = await db
      .selectFrom("work_list")
      .select("position")
      .where("id", "=", res.body.id)
      .executeTakeFirstOrThrow();
    // Watch List is 0 and Reviews is 1, so the new list lands at 2.
    expect(Number(row.position)).toBe(2);
  });

  it.each([
    ["no body", undefined],
    ["an empty title", { title: "" }],
    ["a title over 100 characters", { title: "x".repeat(101) }],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/list`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();

    const res = await api.post(`/api/club/${club.slug}/list`, { body: { title: "X" }, as: bob });

    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/club/:clubSlug/list/reorder", () => {
  it("reassigns positions to the order given", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const second = await createList(club.id, "Second", 2);

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, {
      body: { listIds: [second, club.listId] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const lists = await api.get<ListSummary[]>(`/api/club/${club.slug}/list`);
    expect(lists.body.map((list) => list.title)).toEqual(["Second", "Watch List"]);
  });

  it("rejects a payload that omits one of the club's lists", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    await createList(club.id, "Second", 2);

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, {
      body: { listIds: [club.listId] },
      as: alice,
    });

    expect(res.statusCode).toBe(500);
  });

  it.each([
    ["no body", undefined],
    ["an empty listIds array", { listIds: [] }],
    ["malformed JSON", "{ not json"],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/list/reorder`, { body, as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/list/:listId", () => {
  it("returns the list's items with their cached metadata, in position order", async () => {
    const club = await createClub();
    await cacheMovieDetails("11");
    const first = await createWork(club.id, { externalId: "11", title: "Star Wars" });
    const second = await createWork(club.id, { externalId: null, title: "Untracked" });
    await addToList(club.listId, second.id, { position: 2 });
    await addToList(club.listId, first.id, { position: 1 });

    const res = await api.get<DetailedWorkListItem<MovieDataSummary>[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.map((item) => item.title)).toEqual(["Star Wars", "Untracked"]);
    expect(res.body[0].externalData?.overview).toBe("Overview for movie 11");
    // The bulk payload omits cast lists; only `castNames` rides along.
    expect(res.body[0].externalData).not.toHaveProperty("actors");
    expect(res.body[0].externalData?.castNames).toEqual(["Lead 11", "Support 11"]);
    expect(res.body[1].externalData).toBeUndefined();
  });

  it("records who added an item and when", async () => {
    const club = await createClub();
    const adder = await createUser({ name: "Adder" });
    const work = await createWork(club.id, { externalId: null });
    const timeAdded = new Date("2024-03-04T05:06:07.000Z");
    await addToList(club.listId, work.id, { addedBy: adder.userId, timeAdded });

    const res = await api.get<DetailedWorkListItem[]>(`/api/club/${club.slug}/list/${club.listId}`);

    expect(res.body[0].addedBy).toBe(adder.userId);
    expect(res.body[0].createdDate).toBe(timeAdded.toISOString());
  });

  it("returns 404 for a list belonging to another club", async () => {
    const club = await createClub();
    const other = await createClub();

    const res = await api.get(`/api/club/${club.slug}/list/${other.listId}`);

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/club/:clubSlug/list/all-items", () => {
  it("returns every user list's items tagged with its source list", async () => {
    const club = await createClub();
    const shortlist = await createList(club.id, "Shortlist", 2);
    const onWatchList = await createWork(club.id, { externalId: null, title: "On Watch List" });
    const onShortlist = await createWork(club.id, { externalId: null, title: "On Shortlist" });
    const reviewed = await createWork(club.id, { externalId: null, title: "Reviewed" });
    await addToList(club.listId, onWatchList.id);
    await addToList(shortlist, onShortlist.id);
    await addToList(club.reviewsListId, reviewed.id);

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
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}`, {
      body: { title: "Renamed" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const lists = await api.get<ListSummary[]>(`/api/club/${club.slug}/list`);
    expect(lists.body[0].title).toBe("Renamed");
  });

  it("refuses to rename a system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put<{ error: string }>(
      `/api/club/${club.slug}/list/${club.reviewsListId}`,
      { body: { title: "Not Reviews" }, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Cannot rename a system list");
    const row = await db
      .selectFrom("work_list")
      .select("title")
      .where("id", "=", club.reviewsListId)
      .executeTakeFirstOrThrow();
    expect(row.title).toBe("Reviews");
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}`, { as: alice });

    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/club/:clubSlug/list/:listId", () => {
  it("deletes a user list and its items", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}`, { as: alice });

    expect(res.statusCode).toBe(200);
    const remaining = await db
      .selectFrom("work_list_item")
      .select("work_id")
      .where("list_id", "=", club.listId)
      .execute();
    expect(remaining).toEqual([]);
    expect((await api.get<ListSummary[]>(`/api/club/${club.slug}/list`)).body).toEqual([]);
  });

  it("refuses to delete a system list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.delete<{ error: string }>(
      `/api/club/${club.slug}/list/${club.reviewsListId}`,
      { as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Cannot delete a system list");
    const row = await db
      .selectFrom("work_list")
      .select("id")
      .where("id", "=", club.reviewsListId)
      .executeTakeFirst();
    expect(row).toBeDefined();
  });
});

describe("POST /api/club/:clubSlug/list/:listId/items", () => {
  it("creates the work, caches its TMDB metadata, and puts it on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
      body: { type: WorkType.movie, title: "Alien", externalId: "348", imageUrl: "/alien.jpg" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    expect(requestsTo("api.themoviedb.org/3/movie/348")).toHaveLength(1);

    const items = await api.get<DetailedWorkListItem<MovieDataSummary>[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
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
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const other = await createList(club.id, "Other");
    const body = { type: WorkType.movie, title: "Alien", externalId: "348" };

    await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { body, as: alice });
    await api.post(`/api/club/${club.slug}/list/${other}/items`, { body, as: alice });

    expect(requestsTo("api.themoviedb.org/3/movie/348")).toHaveLength(1);
  });

  it("reuses the existing work when the same external id is added twice", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const other = await createList(club.id, "Other");
    const body = { type: WorkType.movie, title: "Alien", externalId: "348" };

    await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { body, as: alice });
    await api.post(`/api/club/${club.slug}/list/${other}/items`, { body, as: alice });

    const works = await db.selectFrom("work").select("id").where("club_id", "=", club.id).execute();
    expect(works).toHaveLength(1);
  });

  it("rejects a work that is already on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const body = { type: WorkType.movie, title: "Alien", externalId: "348" };

    await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { body, as: alice });
    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items`,
      { body, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Item is already in list");
  });

  it("appends each new item after the last one", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

    for (const externalId of ["1", "2", "3"]) {
      await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
        body: { type: WorkType.movie, title: `Movie ${externalId}`, externalId },
        as: alice,
      });
    }

    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(items.body.map((item) => item.title)).toEqual(["Movie 1", "Movie 2", "Movie 3"]);
  });

  it("still adds the work when the metadata provider fails", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
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
    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(items.body[0].title).toBe("Flaky");
    expect(items.body[0].externalData).toBeUndefined();
  });

  it("caches Google Books metadata for a book club", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ type: ClubType.book, members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, {
      body: { type: WorkType.book, title: "Dune", externalId: "voldune" },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
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
    const club = await createClub({ members: [{ userId: alice.userId }] });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items`, { as: alice });

    expect(res.statusCode).toBe(400);
  });

  it("returns 401 for a non-member", async () => {
    const bob = await signIn("bob");
    const club = await createClub();

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
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const works = await db.selectFrom("work").select("id").where("id", "=", work.id).execute();
    expect(works).toEqual([]);
  });

  it("keeps the work when it is still on another list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const other = await createList(club.id, "Other");
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);
    await addToList(other, work.id);

    const res = await api.delete(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}`, {
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const stillThere = await db
      .selectFrom("work_list_item")
      .select("list_id")
      .where("work_id", "=", work.id)
      .execute();
    expect(stillThere).toEqual([{ list_id: other }]);
  });

  it("returns 400 when the work is not on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });

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
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const works = [
      await createWork(club.id, { externalId: null, title: "A" }),
      await createWork(club.id, { externalId: null, title: "B" }),
      await createWork(club.id, { externalId: null, title: "C" }),
    ];
    await addToList(club.listId, works[0].id, { position: 1 });
    await addToList(club.listId, works[1].id, { position: 2 });
    await addToList(club.listId, works[2].id, { position: 3 });

    const res = await api.put(`/api/club/${club.slug}/list/${club.listId}/reorder`, {
      body: { workIds: [works[2].id, works[0].id, works[1].id] },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(items.body.map((item) => item.title)).toEqual(["C", "A", "B"]);
  });

  it("leaves works outside the payload in their own slots", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const works = [
      await createWork(club.id, { externalId: null, title: "A" }),
      await createWork(club.id, { externalId: null, title: "B" }),
      await createWork(club.id, { externalId: null, title: "C" }),
    ];
    await addToList(club.listId, works[0].id, { position: 1 });
    await addToList(club.listId, works[1].id, { position: 2 });
    await addToList(club.listId, works[2].id, { position: 3 });

    await api.put(`/api/club/${club.slug}/list/${club.listId}/reorder`, {
      body: { workIds: [works[2].id, works[0].id] },
      as: alice,
    });

    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(items.body.map((item) => item.title)).toEqual(["C", "B", "A"]);
  });

  it.each([
    ["no body", undefined],
    ["an empty workIds array", { workIds: [] }],
    ["malformed JSON", "}{"],
  ])("returns 400 with %s", async (_label, body) => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });

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
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.put(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/added-date`,
      { body: { addedDate: "2020-01-02T03:04:05.000Z" }, as: alice },
    );

    expect(res.statusCode).toBe(200);
    const items = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(items.body[0].createdDate).toBe("2020-01-02T03:04:05.000Z");
  });

  it("returns 400 for a date that is not an ISO datetime with an offset", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.put(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/added-date`,
      { body: { addedDate: "2020-01-02" }, as: alice },
    );

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when the work is not on the list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });

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
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const destination = await createList(club.id, "Destination");
    const adder = await createUser({ name: "Adder" });
    const work = await createWork(club.id, { externalId: null, title: "Moved" });
    const timeAdded = new Date("2021-05-06T07:08:09.000Z");
    await addToList(club.listId, work.id, { addedBy: adder.userId, timeAdded });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      body: { destinationListId: destination },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const source = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${club.listId}`,
    );
    expect(source.body).toEqual([]);

    const moved = await api.get<DetailedWorkListItem[]>(
      `/api/club/${club.slug}/list/${destination}`,
    );
    expect(moved.body[0]).toMatchObject({
      title: "Moved",
      addedBy: adder.userId,
      createdDate: timeAdded.toISOString(),
    });
  });

  it("stamps the current time when moving into the reviews list", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    const longAgo = new Date("2015-01-01T00:00:00.000Z");
    await addToList(club.listId, work.id, { timeAdded: longAgo });

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      body: { destinationListId: club.reviewsListId },
      as: alice,
    });

    expect(res.statusCode).toBe(200);
    const item = await db
      .selectFrom("work_list_item")
      .select("time_added")
      .where("list_id", "=", club.reviewsListId)
      .where("work_id", "=", work.id)
      .executeTakeFirstOrThrow();
    expect(item.time_added.getTime()).toBeGreaterThan(longAgo.getTime());
  });

  it("returns 400 when the destination belongs to another club", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const otherClub = await createClub();
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.post<{ error: string }>(
      `/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`,
      { body: { destinationListId: otherClub.listId }, as: alice },
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Destination list not found");
    const stillHome = await db
      .selectFrom("work_list_item")
      .select("list_id")
      .where("work_id", "=", work.id)
      .execute();
    expect(stillHome).toEqual([{ list_id: club.listId }]);
  });

  it("returns 400 without a body", async () => {
    const alice = await signIn("alice");
    const club = await createClub({ members: [{ userId: alice.userId }] });
    const work = await createWork(club.id, { externalId: null });
    await addToList(club.listId, work.id);

    const res = await api.post(`/api/club/${club.slug}/list/${club.listId}/items/${work.id}/move`, {
      as: alice,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/club/:clubSlug/list/reviews", () => {
  it("returns each reviewed work with its per-member scores and average", async () => {
    const club = await createClub();
    const first = await createUser({ name: "First" });
    const second = await createUser({ name: "Second" });
    await addMember(club.id, first.userId);
    await addMember(club.id, second.userId);
    await cacheMovieDetails("13");
    const work = await createReviewedWork(club, { externalId: "13", title: "Forrest Gump" });
    await createReview(club.reviewsListId, work.id, first.userId, 8);
    await createReview(club.reviewsListId, work.id, second.userId, 6);

    const res = await api.get<DetailedReviewListItem<MovieDataSummary>[]>(
      `/api/club/${club.slug}/list/reviews`,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Forrest Gump");
    expect(res.body[0].scores[first.userId].score).toBe(8);
    expect(res.body[0].scores[second.userId].score).toBe(6);
    expect(res.body[0].scores.average.score).toBe(7);
    expect(res.body[0].externalData?.overview).toBe("Overview for movie 13");
  });

  it("excludes the scores of members who have left the club", async () => {
    const club = await createClub();
    const stayed = await createUser({ name: "Stayed" });
    const departed = await createUser({ name: "Departed" });
    await addMember(club.id, stayed.userId);
    const work = await createReviewedWork(club, { externalId: null });
    await createReview(club.reviewsListId, work.id, stayed.userId, 9);
    await createReview(club.reviewsListId, work.id, departed.userId, 1);

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(Object.keys(res.body[0].scores).sort()).toEqual([stayed.userId, "average"].sort());
    expect(res.body[0].scores.average.score).toBe(9);
  });

  it("returns an empty scores map for a work nobody has scored", async () => {
    const club = await createClub();
    await createReviewedWork(club, { externalId: null });

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(res.body[0].scores).toEqual({});
  });

  it("returns the most recently added work first", async () => {
    const club = await createClub();
    await createReviewedWork(club, {
      externalId: null,
      title: "Older",
      timeAdded: new Date("2020-01-01T00:00:00.000Z"),
    });
    await createReviewedWork(club, {
      externalId: null,
      title: "Newer",
      timeAdded: new Date("2024-01-01T00:00:00.000Z"),
    });

    const res = await api.get<DetailedReviewListItem[]>(`/api/club/${club.slug}/list/reviews`);

    expect(res.body.map((item) => item.title)).toEqual(["Newer", "Older"]);
  });
});
