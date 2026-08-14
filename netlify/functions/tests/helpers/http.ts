import { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";

import { ensure } from "../../../../lib/checks/checks";
import type { TestSession } from "./auth";

/** A stub HandlerContext — Netlify's context carries nothing the routers read. */
export const stubContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test",
  functionVersion: "test",
  invokedFunctionArn: "test",
  memoryLimitInMB: "128",
  awsRequestId: "test",
  logGroupName: "test",
  logStreamName: "test",
  getRemainingTimeInMillis: () => 30000,
  done: () => undefined,
  fail: () => undefined,
  succeed: () => undefined,
};

export interface RequestOptions {
  /** Serialized to JSON. Pass a string to send a body verbatim (malformed JSON, etc.). */
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** Authenticates the request with a real signed BetterAuth session cookie. */
  as?: TestSession;
}

export interface ApiResponse<T> {
  statusCode: number;
  headers: Record<string, string>;
  /**
   * Netlify's channel for repeated headers. `Set-Cookie` has to go through
   * here — the Headers API folds repeats into one comma-joined value — so
   * cookie assertions read this, not `headers`.
   */
  multiValueHeaders: Record<string, string[]>;
  /** Parsed JSON body, or the raw string when the response is not JSON. */
  body: T;
  raw: string | undefined;
}

/**
 * Build the HandlerEvent a Netlify function receives. Exported for the few
 * tests that need to hand-roll an event (multipart uploads, base64 bodies).
 */
export function makeEvent(
  options: RequestOptions & { path: string; httpMethod: string },
): HandlerEvent {
  const query = options.query ?? {};
  const rawQuery = new URLSearchParams(query).toString();
  const body =
    options.body === undefined
      ? null
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  return {
    rawUrl: `https://localhost${options.path}${rawQuery ? `?${rawQuery}` : ""}`,
    rawQuery,
    path: options.path,
    httpMethod: options.httpMethod,
    headers: {
      ...(options.as ? { cookie: options.as.cookie } : {}),
      ...options.headers,
    },
    multiValueHeaders: {},
    queryStringParameters: Object.keys(query).length > 0 ? query : null,
    multiValueQueryStringParameters: null,
    body,
    isBase64Encoded: false,
  };
}

/**
 * `JSON.parse` typed to what the caller expects. Like `axios.get<T>`, this
 * types the boundary unchecked — the test's assertions are what actually
 * verify the shape.
 */
const parseJson: <T>(input: string) => T = JSON.parse;

/**
 * Hand a body back with the caller's type without going through the parser:
 * for SVG and redirect responses, and for the handlers that answer
 * `ok("Joined club successfully")` — a bare string under a JSON content type.
 */
function asBody<T>(value: string | undefined): T {
  return parseJson<T>(JSON.stringify(value ?? null));
}

function parseBody<T>(raw: string | undefined, isJson: boolean): T {
  if (!isJson || raw === undefined || raw === "") {
    return asBody<T>(raw);
  }
  try {
    return parseJson<T>(raw);
  } catch {
    return asBody<T>(raw);
  }
}

/** Invoke a handler with a fully-formed event and normalize what comes back. */
export async function send<T = unknown>(
  handler: Handler,
  event: HandlerEvent,
): Promise<ApiResponse<T>> {
  const result = await handler(event, stubContext, () => {
    // Netlify's callback style is unused by these handlers.
  });

  const response: HandlerResponse = ensure(
    result ?? undefined,
    `${event.httpMethod} ${event.path} returned void — expected a HandlerResponse`,
  );

  const headers: Record<string, string> = Object.fromEntries(
    Object.entries(response.headers ?? {}).map(([key, value]) => [key, String(value)]),
  );
  const raw = response.body ?? undefined;
  // The response helpers send `Content-Type`; BetterAuth's Web `Response`
  // lowercases it. Header names are case-insensitive, so match on both.
  const contentType = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "content-type",
  )?.[1];
  const isJson = contentType?.includes("application/json") === true;

  const multiValueHeaders: Record<string, string[]> = Object.fromEntries(
    Object.entries(response.multiValueHeaders ?? {}).map(([key, values]) => [
      key,
      values.map(String),
    ]),
  );

  return {
    statusCode: response.statusCode,
    headers,
    multiValueHeaders,
    body: parseBody<T>(raw, isJson),
    raw,
  };
}

/**
 * Wraps a Netlify function handler in a small HTTP-shaped client so tests read
 * like the requests the frontend actually makes:
 *
 * ```ts
 * const api = requester(handler);
 * const res = await api.get<ClubPreview>(`/api/club/${club.slug}`);
 * await api.post("/api/club", { body: { name: "New" }, as: alice });
 * ```
 */
export function requester(handler: Handler) {
  const call = <T>(httpMethod: string, path: string, options: RequestOptions = {}) =>
    send<T>(handler, makeEvent({ ...options, path, httpMethod }));

  return {
    get: <T = unknown>(path: string, options?: RequestOptions) => call<T>("GET", path, options),
    post: <T = unknown>(path: string, options?: RequestOptions) => call<T>("POST", path, options),
    put: <T = unknown>(path: string, options?: RequestOptions) => call<T>("PUT", path, options),
    delete: <T = unknown>(path: string, options?: RequestOptions) =>
      call<T>("DELETE", path, options),
    patch: <T = unknown>(path: string, options?: RequestOptions) => call<T>("PATCH", path, options),
    /** Escape hatch for requests that need a hand-built event (multipart, base64). */
    send: <T = unknown>(event: HandlerEvent) => send<T>(handler, event),
  };
}
