/**
 * MSW plumbing for the `server` vitest project.
 *
 * Backend HTTP clients are tested the same way the client project tests are:
 * the module under test keeps its real axios, and only the network is faked.
 * That way the request axios actually puts on the wire — URL, query string,
 * serialised body — is what the assertions see, instead of the arguments we
 * happened to pass to a mocked function.
 *
 * Lifecycle (listen/reset/close) lives in ./setup.ts.
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer();

export interface CapturedRequest {
  /** Full request URL, so tests can assert on path and query params. */
  url: URL;
  /** Parsed JSON body. `undefined` for GET requests. */
  body: unknown;
}

/** A handler either returns a value to send as JSON, or a full `Response`. */
type Reply = JsonBodyType | Response;

function capture(
  method: "get" | "post",
  path: string,
  reply: (request: CapturedRequest) => Reply,
): CapturedRequest[] {
  const calls: CapturedRequest[] = [];

  server.use(
    http[method](path, async ({ request }) => {
      const captured: CapturedRequest = {
        url: new URL(request.url),
        body: method === "post" ? ((await request.json()) as unknown) : undefined,
      };
      calls.push(captured);

      const result = reply(captured);
      return result instanceof Response ? result : HttpResponse.json(result);
    }),
  );

  return calls;
}

/**
 * Serve GET `path` (an msw path pattern, so `:params` work) for the duration of
 * the test. Returns the array requests are recorded into — read it after the
 * call under test to assert on what was actually requested.
 */
export function captureGet(
  path: string,
  reply: (request: CapturedRequest) => Reply,
): CapturedRequest[] {
  return capture("get", path, reply);
}

/** As {@link captureGet}, for POST. `body` is the parsed JSON request body. */
export function capturePost(
  path: string,
  reply: (request: CapturedRequest) => Reply,
): CapturedRequest[] {
  return capture("post", path, reply);
}
