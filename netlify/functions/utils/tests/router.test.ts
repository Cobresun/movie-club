import { HandlerContext, HandlerEvent } from "@netlify/functions";
import { describe, expect, it, vi } from "vitest";

import {
  Request,
  Router,
  createRouterResponse,
  isRequest,
  isRouterResponse,
} from "../router";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  path: string,
  httpMethod: string,
  body: string | null = null,
): HandlerEvent {
  return {
    path,
    httpMethod,
    body,
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

function makeRequest(
  path: string,
  httpMethod: string,
  params: Record<string, string> = {},
): Request {
  return {
    event: makeEvent(path, httpMethod),
    context: stubContext,
    params,
  };
}

// ---------------------------------------------------------------------------
// isRouterResponse
// ---------------------------------------------------------------------------

describe("isRouterResponse", () => {
  it("returns true for an object produced by createRouterResponse", () => {
    const rr = createRouterResponse({ statusCode: 200 });
    expect(isRouterResponse(rr)).toBe(true);
  });

  it("returns false for a plain object without the type symbol", () => {
    expect(isRouterResponse({ statusCode: 200 })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRouterResponse(null)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isRouterResponse("hello")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRequest
// ---------------------------------------------------------------------------

describe("isRequest", () => {
  it("returns true for a well-formed Request object", () => {
    expect(isRequest(makeRequest("/foo", "GET"))).toBe(true);
  });

  it("returns false when event is missing", () => {
    expect(isRequest({ context: stubContext, params: {} })).toBe(false);
  });

  it("returns false when context is missing", () => {
    expect(isRequest({ event: makeEvent("/", "GET"), params: {} })).toBe(false);
  });

  it("returns false when params is missing", () => {
    expect(
      isRequest({ event: makeEvent("/", "GET"), context: stubContext }),
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRequest(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Router — basic GET routing
// ---------------------------------------------------------------------------

describe("Router — GET route matching", () => {
  it("responds 200 when path and method match", async () => {
    const router = new Router();
    router.get("/items", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/items", "GET"));
    expect(result.statusCode).toBe(200);
  });

  it("responds 404 for an unregistered path", async () => {
    const router = new Router();
    router.get("/items", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/unknown", "GET"));
    expect(result.statusCode).toBe(404);
  });

  it("responds 405 when path is known but method differs", async () => {
    const router = new Router();
    router.get("/items", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/items", "POST"));
    expect(result.statusCode).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Router — HTTP method routing
// ---------------------------------------------------------------------------

describe("Router — HTTP methods", () => {
  it("routes POST correctly", async () => {
    const router = new Router();
    router.post("/items", async (_req, res) => res({ statusCode: 201 }));

    const result = await router.route(makeRequest("/items", "POST"));
    expect(result.statusCode).toBe(201);
  });

  it("routes PUT correctly", async () => {
    const router = new Router();
    router.put("/items/1", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/items/1", "PUT"));
    expect(result.statusCode).toBe(200);
  });

  it("routes DELETE correctly", async () => {
    const router = new Router();
    router.delete("/items/1", async (_req, res) => res({ statusCode: 204 }));

    const result = await router.route(makeRequest("/items/1", "DELETE"));
    expect(result.statusCode).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Router — path parameters
// ---------------------------------------------------------------------------

describe("Router — path parameters", () => {
  it("extracts a single path param and passes it to the handler", async () => {
    const router = new Router();
    let capturedParams: Record<string, string | undefined> = {};

    router.get("/:id", async (req, res) => {
      capturedParams = req.params;
      return res({ statusCode: 200 });
    });

    await router.route(makeRequest("/42", "GET"));
    expect(capturedParams["id"]).toBe("42");
  });

  it("extracts multiple path params", async () => {
    const router = new Router();
    let capturedParams: Record<string, string | undefined> = {};

    router.get("/:clubSlug/items/:itemId", async (req, res) => {
      capturedParams = req.params;
      return res({ statusCode: 200 });
    });

    await router.route(makeRequest("/my-club/items/99", "GET"));
    expect(capturedParams["clubSlug"]).toBe("my-club");
    expect(capturedParams["itemId"]).toBe("99");
  });
});

// ---------------------------------------------------------------------------
// Router — baseUrl
// ---------------------------------------------------------------------------

describe("Router — baseUrl prefix", () => {
  it("matches when path includes the base URL prefix", async () => {
    const router = new Router("/api");
    router.get("/items", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/api/items", "GET"));
    expect(result.statusCode).toBe(200);
  });

  it("does not match when path is missing the base URL prefix", async () => {
    const router = new Router("/api");
    router.get("/items", async (_req, res) => res({ statusCode: 200 }));

    const result = await router.route(makeRequest("/items", "GET"));
    expect(result.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Router — middleware chaining
// ---------------------------------------------------------------------------

describe("Router — middleware chaining", () => {
  it("passes transformed request through middleware chain", async () => {
    const router = new Router();

    type EnrichedRequest = Request & { userId: string };

    const addUser = async (req: Request): Promise<EnrichedRequest> => {
      return { ...req, userId: "user-123" };
    };

    let capturedUserId = "";
    router.get("/profile", addUser, async (req: EnrichedRequest, res) => {
      capturedUserId = req.userId;
      return res({ statusCode: 200 });
    });

    await router.route(makeRequest("/profile", "GET"));
    expect(capturedUserId).toBe("user-123");
  });

  it("short-circuits the chain when middleware returns a RouterResponse", async () => {
    const router = new Router();
    const secondMiddlewareCalled = vi.fn();

    router.get(
      "/protected",
      async (_req, res) => res({ statusCode: 401 }),
      async (_req, res) => {
        secondMiddlewareCalled();
        return res({ statusCode: 200 });
      },
    );

    const result = await router.route(makeRequest("/protected", "GET"));
    expect(result.statusCode).toBe(401);
    expect(secondMiddlewareCalled).not.toHaveBeenCalled();
  });

  it("returns 500 when the chain never returns a RouterResponse", async () => {
    const router = new Router();

    // Register a route with an empty chain (no handlers)
    router.get("/empty");

    const result = await router.route(makeRequest("/empty", "GET"));
    expect(result.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Router — error handling
// ---------------------------------------------------------------------------

describe("Router — error handling", () => {
  it("returns 500 when a middleware throws an error", async () => {
    const router = new Router();
    router.get("/boom", async () => {
      throw new Error("Unexpected failure");
    });

    const result = await router.route(makeRequest("/boom", "GET"));
    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when a middleware throws a non-Error value", async () => {
    const router = new Router();

    router.get("/boom", async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- this test exercises the dispatcher's handling of non-Error throws
      throw "string error";
    });

    const result = await router.route(makeRequest("/boom", "GET"));
    expect(result.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Router — use() sub-routers
// ---------------------------------------------------------------------------

describe("Router — use() sub-routers", () => {
  it("delegates to a sub-router when path prefix matches", async () => {
    // In production, child routers include their full base URL (e.g.
    // new Router("/api/items")) so their routes match the complete path.
    const parent = new Router();
    const child = new Router("/api");

    child.get("/items", async (_req, res) => res({ statusCode: 200 }));

    parent.use("/api", child);

    const result = await parent.route(makeRequest("/api/items", "GET"));
    expect(result.statusCode).toBe(200);
  });

  it("returns 404 when no sub-router path matches", async () => {
    const parent = new Router();
    const child = new Router("/api");

    child.get("/items", async (_req, res) => res({ statusCode: 200 }));

    parent.use("/api", child);

    const result = await parent.route(makeRequest("/other/items", "GET"));
    expect(result.statusCode).toBe(404);
  });

  it("supports middleware before the sub-router in use() chain", async () => {
    type TaggedRequest = Request & { tag: string };

    const parent = new Router();
    const child = new Router<TaggedRequest>("/api");

    const addTag = async (req: Request): Promise<TaggedRequest> => ({
      ...req,
      tag: "enriched",
    });

    let capturedTag = "";
    child.get("/data", async (req, res) => {
      capturedTag = req.tag;
      return res({ statusCode: 200 });
    });

    parent.use("/api", addTag, child);

    await parent.route(makeRequest("/api/data", "GET"));
    expect(capturedTag).toBe("enriched");
  });
});
