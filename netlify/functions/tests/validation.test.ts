/**
 * Integration tests for `netlify/functions/utils/validation.ts`.
 *
 * The two middlewares are the club-scoping boundary for every route, so they
 * are exercised against real `club` and `work_list` rows rather than mocked
 * repositories — the interesting cases (an id that exists but belongs to
 * someone else) are precisely the ones a mock cannot tell apart.
 */
import { HandlerResponse } from "@netlify/functions";
import { describe, expect, it } from "vitest";

import { ClubType, WorkListSystemType } from "../../../lib/types/generated/db";
import { createRouterResponse, isRouterResponse, Request } from "../utils/router";
import { ClubRequest, validClubSlug, validListId } from "../utils/validation";
import { db } from "./helpers/database";
import { createClub, createList } from "./helpers/factories";
import { makeEvent, stubContext } from "./helpers/http";

/** The router's own `res` callback, so the middlewares behave exactly as in a real chain. */
const respond = createRouterResponse;

function request(params: Record<string, string>): Request {
  return {
    event: makeEvent({ path: "/api/club", httpMethod: "GET" }),
    context: stubContext,
    params,
  };
}

function clubRequest(clubId: string, params: Record<string, string>): ClubRequest {
  return {
    ...request(params),
    clubId,
    clubSlug: "irrelevant",
    clubType: ClubType.movie,
    clubName: "Irrelevant",
    clubSlugUpdatedAt: null,
  };
}

/** Narrow a middleware result to the short-circuit response it produced. */
function responseOf(result: unknown): HandlerResponse {
  if (!isRouterResponse(result)) {
    throw new Error("Expected the middleware to short-circuit with a response");
  }
  return result.response;
}

describe("validClubSlug", () => {
  it("puts the resolved club on the request", async () => {
    const club = await createClub({ name: "Resolved", slug: "resolved-club" });

    const result = await validClubSlug(request({ clubSlug: "resolved-club" }), respond);

    expect(isRouterResponse(result)).toBe(false);
    if (isRouterResponse(result)) return;
    expect(result).toMatchObject({
      clubId: club.id,
      clubSlug: "resolved-club",
      clubName: "Resolved",
      clubType: ClubType.movie,
      clubSlugUpdatedAt: null,
    });
  });

  it("forwards slug_updated_at so the club route need not look it up again", async () => {
    const club = await createClub({ slug: "stamped-club" });
    const stampedAt = new Date("2026-01-02T03:04:05.000Z");
    await db
      .updateTable("club")
      .set({ slug_updated_at: stampedAt })
      .where("id", "=", club.id)
      .execute();

    const result = await validClubSlug(request({ clubSlug: "stamped-club" }), respond);

    if (isRouterResponse(result)) throw new Error("Expected the club to resolve");
    expect(result.clubSlugUpdatedAt).toEqual(stampedAt);
  });

  it.each([
    ["the param is missing", {}],
    ["the param is empty", { clubSlug: "" }],
    ["no club has that slug", { clubSlug: "nobody-here" }],
  ])("returns 404 when %s", async (_label, params) => {
    const result = await validClubSlug(request(params), respond);

    expect(responseOf(result).statusCode).toBe(404);
  });
});

describe("validListId", () => {
  it("puts the resolved list and its system type on the request", async () => {
    const club = await createClub();

    const result = await validListId(clubRequest(club.id, { listId: club.listId }), respond);

    if (isRouterResponse(result)) throw new Error("Expected the list to resolve");
    expect(result).toMatchObject({ listId: club.listId, listSystemType: null });
  });

  it("exposes the system type so handlers can gate on it", async () => {
    const club = await createClub();

    const result = await validListId(clubRequest(club.id, { listId: club.reviewsListId }), respond);

    if (isRouterResponse(result)) throw new Error("Expected the list to resolve");
    expect(result.listSystemType).toBe(WorkListSystemType.reviews);
  });

  it("returns 404 for a list that belongs to a different club", async () => {
    const club = await createClub();
    const other = await createClub();
    const otherList = await createList(other.id, "Theirs");

    const result = await validListId(clubRequest(club.id, { listId: otherList }), respond);

    expect(responseOf(result).statusCode).toBe(404);
  });

  it.each([
    ["the param is missing", {}],
    ["no list has that id", { listId: "999999" }],
  ])("returns 404 when %s", async (_label, params) => {
    const club = await createClub();

    const result = await validListId(clubRequest(club.id, params), respond);

    expect(responseOf(result).statusCode).toBe(404);
  });
});
