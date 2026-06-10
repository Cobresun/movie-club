import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";

import { ensure } from "../../../lib/checks/checks";

/**
 * Narrow a `void | HandlerResponse` to `HandlerResponse`, throwing if the
 * handler returned void (which should never happen in these tests).
 */
export function assertResponse(
  result: void | HandlerResponse,
): HandlerResponse {
  return ensure(
    result ?? undefined,
    "Handler returned void — expected a HandlerResponse",
  );
}

/**
 * Build a minimal HandlerEvent for testing.
 * All required fields are provided; optional fields can be overridden.
 */
export function makeEvent(
  overrides: Partial<HandlerEvent> & {
    path: string;
    httpMethod: string;
  },
): HandlerEvent {
  return {
    rawUrl: `https://localhost${overrides.path}`,
    rawQuery: overrides.rawQuery ?? "",
    path: overrides.path,
    httpMethod: overrides.httpMethod,
    headers: overrides.headers ?? {},
    multiValueHeaders: overrides.multiValueHeaders ?? {},
    queryStringParameters: overrides.queryStringParameters ?? null,
    multiValueQueryStringParameters:
      overrides.multiValueQueryStringParameters ?? null,
    body: overrides.body ?? null,
    isBase64Encoded: overrides.isBase64Encoded ?? false,
  };
}

/**
 * A stub HandlerContext — no real Netlify context needed in unit tests.
 */
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

/**
 * Parse the JSON body of a HandlerResponse.
 *
 * Like `axios.get<T>`, this types the JSON boundary unchecked — the test's
 * assertions are what actually verify the shape.
 */
export function parseBody<T = unknown>(body: string | null | undefined): T {
  const parse: (text: string) => T = JSON.parse;
  return parse(body ?? "{}");
}
