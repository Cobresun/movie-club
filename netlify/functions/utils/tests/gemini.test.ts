/**
 * Tests for netlify/functions/utils/gemini.ts
 *
 * Real axios against MSW-faked HTTP: `netlify/functions/tests/mocks/handlers.ts`
 * answers the Gemini endpoint with a well-formed structured-output body, and a
 * test overrides it with `server.use` to exercise the malformed and failing
 * responses.
 * GEMINI_API_KEY is provided/removed via vi.stubEnv (read per call, so no
 * module reset is needed).
 */
import { HttpResponse, http, type JsonBodyType } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { geminiJsonResponse } from "../../tests/fixtures/external";
import { GEMINI_QUESTIONS } from "../../tests/mocks/handlers";
import { server } from "../../tests/mocks/server";
import { generateJson } from "../gemini";

// Wildcard rather than the literal path: the model segment ends in
// `:generateContent`, which msw's path parser would read as a path parameter.
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/*";

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

/** The shape callers most commonly ask Gemini for: `{ questions: string[] }`. */
const questionsSchema = z.object({ questions: z.array(z.string()) });

const questionsResponseSchema = {
  type: "object",
  properties: { questions: { type: "array", items: { type: "string" } } },
  required: ["questions"],
};

function callGenerateJson(prompt = "Generate discussion prompts for Inception.") {
  return generateJson({
    prompt,
    responseSchema: questionsResponseSchema,
    schema: questionsSchema,
  });
}

/** Answer the Gemini endpoint with `body` for the rest of this test. */
function respondWith(body: JsonBodyType) {
  server.use(http.post(GEMINI_URL, () => HttpResponse.json(body)));
}

// ─── generateJson ─────────────────────────────────────────────────────────────

describe("generateJson", () => {
  it("returns the parsed payload from a well-formed Gemini response", async () => {
    const result = await callGenerateJson();

    expect(result.questions).toEqual(GEMINI_QUESTIONS);
  });

  it("accepts an empty collection when the caller's schema allows it", async () => {
    respondWith(geminiJsonResponse({ questions: [] }));

    const result = await callGenerateJson();

    expect(result.questions).toEqual([]);
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    // Force the key empty rather than calling vi.unstubAllEnvs(), which would
    // restore the ambient environment — unset locally but populated on CI
    // (Netlify injects the real secret), making the test non-deterministic.
    vi.stubEnv("GEMINI_API_KEY", "");

    await expect(callGenerateJson()).rejects.toThrow("GEMINI_API_KEY is not configured");
  });

  it("throws when the response contains no candidates", async () => {
    respondWith({ candidates: [] });

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the candidate content is missing text", async () => {
    respondWith({ candidates: [{ content: { parts: [{}] } }] });

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the JSON does not match the caller's schema", async () => {
    respondWith(geminiJsonResponse({ wrong: "shape" }));

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned malformed JSON");
  });

  it("propagates API errors", async () => {
    server.use(
      http.post(GEMINI_URL, () => HttpResponse.json({ error: "unavailable" }, { status: 503 })),
    );

    await expect(callGenerateJson()).rejects.toThrow("Request failed with status code 503");
  });

  it("propagates transport failures", async () => {
    server.use(http.post(GEMINI_URL, () => HttpResponse.error()));

    await expect(callGenerateJson()).rejects.toThrow();
  });
});
