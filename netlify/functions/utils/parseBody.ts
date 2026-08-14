import { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { ZodType, ZodTypeDef } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import { badRequest } from "./responses";
import { RouterResponse } from "./router";

/**
 * Reads, JSON-parses, and Zod-validates a request body in one step. Returns
 * the parsed data, or a `RouterResponse` the caller should return directly
 * (check with `isRouterResponse`) — covering the "missing body", "malformed
 * JSON", and "fails schema" cases with a single 400 response each.
 *
 * `Input` is pinned to `any` rather than left to default to `Output`: with it
 * defaulted, a schema using `.default()` (output field required, input field
 * optional) makes TS infer `T` as the union of both, silently widening parsed
 * fields back to optional.
 */
export function parseBody<T>(
  event: HandlerEvent,
  schema: ZodType<T, ZodTypeDef, any>,
  res: (data: HandlerResponse) => RouterResponse,
): T | RouterResponse {
  if (!hasValue(event.body)) return res(badRequest("No body provided"));

  let json: unknown;
  try {
    json = JSON.parse(event.body);
  } catch {
    return res(badRequest("Invalid body"));
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) return res(badRequest("Invalid body"));

  return parsed.data;
}
