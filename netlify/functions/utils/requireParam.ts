import { HandlerResponse } from "@netlify/functions";

import { hasValue } from "../../../lib/checks/checks.js";
import { badRequest } from "./responses";
import { RouterResponse } from "./router";
import { StringRecord } from "./types";

/**
 * path-parser resolves an unmatched or empty path segment to `undefined` in
 * StringRecord rather than erroring, so any handler that uses a param beyond
 * the clubSlug/listId/year already resolved by middleware needs its own
 * check. Centralizes the hasValue-guard-and-400 that was hand-rolled per
 * param per route, with one consistent message.
 */
export function requireParam<K extends string>(
  params: StringRecord,
  name: K,
  res: (data: HandlerResponse) => RouterResponse,
): string | RouterResponse {
  const value = params[name];
  if (!hasValue(value)) {
    return res(badRequest(`No ${name} provided`));
  }
  return value;
}
