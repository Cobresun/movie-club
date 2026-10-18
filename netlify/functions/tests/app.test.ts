/**
 * Tests for `netlify/functions/app.ts` — the minimum mobile app version the app checks at launch.
 */
import { describe, expect, it } from "vitest";

import { handler, MINIMUM_APP_VERSION } from "../app";
import { requester } from "./helpers/http";

const api = requester(handler);

describe("GET /api/app/version", () => {
  it("returns the oldest app version still allowed to run, without a session", async () => {
    const res = await api.get<string>("/api/app/version");

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "")).toEqual({ minimumVersion: MINIMUM_APP_VERSION });
  });
});
