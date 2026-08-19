import { describe, expect, it } from "vitest";
import { z } from "zod";

import { requireParam } from "../requireParam";
import { createRouterResponse, isRouterResponse } from "../router";

const errorBodySchema = z.object({ error: z.string() });

function parseErrorBody(body: string | undefined): { error: string } {
  const raw: unknown = JSON.parse(body ?? "{}");
  return errorBodySchema.parse(raw);
}

describe("requireParam", () => {
  const res = createRouterResponse;

  it("returns the param value when present", () => {
    const result = requireParam({ workId: "abc123" }, "workId", res);
    expect(result).toBe("abc123");
  });

  it("returns a 400 RouterResponse when the param is missing", () => {
    const result = requireParam({}, "workId", res);
    expect(isRouterResponse(result)).toBe(true);
    if (isRouterResponse(result)) {
      expect(result.response.statusCode).toBe(400);
      expect(parseErrorBody(result.response.body).error).toBe("No workId provided");
    }
  });

  it("returns a 400 RouterResponse when the param is an empty string", () => {
    const result = requireParam({ workId: "" }, "workId", res);
    expect(isRouterResponse(result)).toBe(true);
    if (isRouterResponse(result)) {
      expect(result.response.statusCode).toBe(400);
    }
  });

  it("names the missing param in the error message", () => {
    const result = requireParam({}, "commentId", res);
    if (isRouterResponse(result)) {
      expect(parseErrorBody(result.response.body).error).toBe("No commentId provided");
    }
  });
});
