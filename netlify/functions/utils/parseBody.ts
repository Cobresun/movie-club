import { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { z, ZodType } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";
import { badRequest } from "./responses";
import { RouterResponse } from "./router";

/**
 * Reads, JSON-parses, and Zod-validates a request body in one step. Returns
 * the parsed data, or a `RouterResponse` the caller should return directly
 * (check with `isRouterResponse`) — covering the "missing body", "malformed
 * JSON", and "fails schema" cases with a single 400 response each.
 *
 * The return type is inferred from the schema itself rather than from a bare
 * output type parameter: `z.output` keeps a schema using `.default()` (output
 * field required, input field optional) from widening the parsed field back to
 * optional.
 */
export function parseBody<S extends ZodType>(
  event: HandlerEvent,
  schema: S,
  res: (data: HandlerResponse) => RouterResponse,
): z.output<S> | RouterResponse {
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
