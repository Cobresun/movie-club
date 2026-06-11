import { HandlerContext, HandlerEvent } from "@netlify/functions";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ClubType,
  WorkListSystemType,
} from "../../../../lib/types/generated/db";
import ClubRepository from "../../repositories/ClubRepository";
import ListRepository from "../../repositories/ListRepository";
import { Request } from "../router";
import { ClubRequest, validClubSlug, validListId } from "../validation";

// Vitest hoists vi.mock above all imports, so the database and repositories
// are mocked before any module with a DB import resolves.
vi.mock("../database", () => ({ db: {}, pool: {}, dialect: {} }));

vi.mock("../../repositories/ClubRepository", () => ({
  default: {
    getBySlug: vi.fn(),
  },
}));

vi.mock("../../repositories/ListRepository", () => ({
  default: {
    getListById: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(path: string): HandlerEvent {
  return {
    path,
    httpMethod: "GET",
    body: null,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    rawUrl: `http://localhost${path}`,
    rawQuery: "",
  };
}

const stubContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test",
  functionVersion: "1",
  invokedFunctionArn: "",
  memoryLimitInMB: "128",
  awsRequestId: "",
  logGroupName: "",
  logStreamName: "",
  clientContext: undefined,
  identity: undefined,
  getRemainingTimeInMillis: () => 0,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function makeBaseRequest(params: Record<string, string> = {}): Request {
  return {
    event: makeEvent("/test"),
    context: stubContext,
    params,
  };
}

function makeClubRequest(
  clubId: string,
  clubSlug: string,
  extraParams: Record<string, string> = {},
): ClubRequest {
  return {
    event: makeEvent("/test"),
    context: stubContext,
    params: extraParams,
    clubId,
    clubSlug,
    clubType: ClubType.movie,
  };
}

// Typed res helper that records what was passed
function makeRes() {
  const calls: { statusCode: number }[] = [];
  const res = (data: { statusCode: number }) => {
    calls.push(data);
    return { type: Symbol(), response: data } as unknown as ReturnType<
      Parameters<typeof validClubSlug>[1]
    >;
  };
  return { res, calls };
}

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// validClubSlug
// ---------------------------------------------------------------------------

describe("validClubSlug", () => {
  it("returns 404 when clubSlug param is missing", async () => {
    const { res, calls } = makeRes();
    const req = makeBaseRequest({});
    await validClubSlug(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("returns 404 when clubSlug param is an empty string", async () => {
    const { res, calls } = makeRes();
    const req = makeBaseRequest({ clubSlug: "" });
    await validClubSlug(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("returns 404 when the club is not found in the repository", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);
    const { res, calls } = makeRes();
    const req = makeBaseRequest({ clubSlug: "nonexistent" });
    await validClubSlug(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("enriches the request with clubId and clubSlug on success", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue({
      id: "42",
      slug: "my-club",
      name: "My Club",
      type: ClubType.movie,
      legacy_id: null,
      slug_updated_at: null,
    });

    const req = makeBaseRequest({ clubSlug: "my-club" });
    const { res } = makeRes();
    const result = await validClubSlug(req, res);

    // result should be the enriched request (not a RouterResponse)
    expect(result).toMatchObject({ clubId: "42", clubSlug: "my-club" });
  });

  it("calls ClubRepository.getBySlug with the correct slug", async () => {
    vi.mocked(ClubRepository.getBySlug).mockResolvedValue(undefined);
    const req = makeBaseRequest({ clubSlug: "film-buffs" });
    const { res } = makeRes();
    await validClubSlug(req, res);
    expect(ClubRepository.getBySlug).toHaveBeenCalledWith("film-buffs");
  });
});

// ---------------------------------------------------------------------------
// validListId
// ---------------------------------------------------------------------------

describe("validListId", () => {
  it("returns 404 when listId param is missing", async () => {
    const { res, calls } = makeRes();
    const req = makeClubRequest("42", "my-club", {});
    await validListId(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("returns 404 when listId param is an empty string", async () => {
    const { res, calls } = makeRes();
    const req = makeClubRequest("42", "my-club", { listId: "" });
    await validListId(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("returns 404 when the list is not found for the club", async () => {
    vi.mocked(ListRepository.getListById).mockResolvedValue(undefined);
    const { res, calls } = makeRes();
    const req = makeClubRequest("42", "my-club", { listId: "99" });
    await validListId(req, res);
    expect(calls[0]?.statusCode).toBe(404);
  });

  it("enriches the request with listId and listSystemType on success", async () => {
    vi.mocked(ListRepository.getListById).mockResolvedValue({
      id: "99",
      club_id: "42",
      title: "Watch List",
      system_type: null,
      position: "0",
    });

    const req = makeClubRequest("42", "my-club", { listId: "99" });
    const { res } = makeRes();
    const result = await validListId(req, res);

    expect(result).toMatchObject({ listId: "99", listSystemType: null });
  });

  it("exposes the listSystemType from the resolved list", async () => {
    vi.mocked(ListRepository.getListById).mockResolvedValue({
      id: "10",
      club_id: "42",
      title: "Reviews",
      system_type: WorkListSystemType.reviews,
      position: "0",
    });

    const req = makeClubRequest("42", "my-club", { listId: "10" });
    const { res } = makeRes();
    const result = await validListId(req, res);

    expect(result).toMatchObject({
      listSystemType: WorkListSystemType.reviews,
    });
  });

  it("calls ListRepository.getListById with listId and clubId", async () => {
    vi.mocked(ListRepository.getListById).mockResolvedValue(undefined);
    const req = makeClubRequest("42", "my-club", { listId: "7" });
    const { res } = makeRes();
    await validListId(req, res);
    expect(ListRepository.getListById).toHaveBeenCalledWith("7", "42");
  });
});
