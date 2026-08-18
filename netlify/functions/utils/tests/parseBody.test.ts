import { assert, describe, expect, it } from "vitest";
import { z } from "zod";

import { makeEvent } from "../../tests/helpers/http";
import { parseBody } from "../parseBody";
import { createRouterResponse, isRouterResponse } from "../router";

const schema = z.object({ name: z.string() });

/** `body: undefined` is how `makeEvent` spells "no body at all". */
const post = (body?: unknown) => makeEvent({ path: "/", httpMethod: "POST", body });

describe("parseBody", () => {
  it("returns the parsed data for a valid body", () => {
    const result = parseBody(post({ name: "club" }), schema, createRouterResponse);
    expect(isRouterResponse(result)).toBe(false);
    expect(result).toEqual({ name: "club" });
  });

  it("returns a 400 when the body is missing", () => {
    const result = parseBody(post(), schema, createRouterResponse);
    assert(isRouterResponse(result));
    expect(result.response.statusCode).toBe(400);
  });

  it("returns a 400 when the body is empty", () => {
    const result = parseBody(post(""), schema, createRouterResponse);
    assert(isRouterResponse(result));
    expect(result.response.statusCode).toBe(400);
  });

  it("returns a 400 instead of throwing when the body is malformed JSON", () => {
    const result = parseBody(post("{not json"), schema, createRouterResponse);
    assert(isRouterResponse(result));
    expect(result.response.statusCode).toBe(400);
  });

  it("returns a 400 when the body fails schema validation", () => {
    const result = parseBody(post({ name: 5 }), schema, createRouterResponse);
    assert(isRouterResponse(result));
    expect(result.response.statusCode).toBe(400);
  });

  it("applies schema defaults to the parsed output", () => {
    const withDefault = z.object({ type: z.enum(["a", "b"]).default("a") });
    const result = parseBody(post({}), withDefault, createRouterResponse);
    expect(result).toEqual({ type: "a" });
  });
});
