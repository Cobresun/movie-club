/**
 * Tests for netlify/functions/utils/gemini.ts
 *
 * Real axios against MSW-faked HTTP: the request body the assertions inspect is
 * the JSON axios actually serialised onto the wire.
 * GEMINI_API_KEY is provided/removed via vi.stubEnv (read per call, so no
 * module reset is needed).
 */
import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { capturePost, type CapturedRequest } from "../../tests/msw";
import { generateJson } from "../gemini";

// Wildcard rather than the literal path: the model segment ends in
// `:generateContent`, which msw's path parser would read as a path parameter.
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/*";

// Schema for the Gemini request body captured by MSW — typed extraction
// without `as` casts.
const geminiRequestSchema = z.object({
  contents: z.array(z.object({ parts: z.array(z.object({ text: z.string() })) })),
  generationConfig: z.object({
    temperature: z.number().optional(),
    responseMimeType: z.string(),
    responseSchema: z.record(z.unknown()),
  }),
});

function parseRequest(calls: CapturedRequest[]) {
  return geminiRequestSchema.parse(calls[0]?.body);
}

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

/** A Gemini success body wrapping `payload` as the candidate's JSON text. */
function geminiResponse(payload: unknown) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] };
}

function callGenerateJson(prompt = "Generate discussion prompts for Inception.") {
  return generateJson({
    prompt,
    responseSchema: questionsResponseSchema,
    schema: questionsSchema,
  });
}

// ─── generateJson ─────────────────────────────────────────────────────────────

describe("generateJson", () => {
  it("returns the parsed payload from a well-formed Gemini response", async () => {
    capturePost(GEMINI_URL, () =>
      geminiResponse({
        questions: ["Was the ending inevitable?", "What does the spinning top symbolise?"],
      }),
    );

    const result = await callGenerateJson();

    expect(result.questions).toEqual([
      "Was the ending inevitable?",
      "What does the spinning top symbolise?",
    ]);
  });

  it("accepts an empty collection when the caller's schema allows it", async () => {
    capturePost(GEMINI_URL, () => geminiResponse({ questions: [] }));

    const result = await callGenerateJson();

    expect(result.questions).toEqual([]);
  });

  it("posts to the Gemini endpoint with the api key in the URL", async () => {
    const calls = capturePost(GEMINI_URL, () => geminiResponse({ questions: ["Q1"] }));

    await callGenerateJson();

    expect(calls[0]?.url.pathname).toContain("models/gemini-3.5-flash:generateContent");
    expect(calls[0]?.url.searchParams.get("key")).toBe("test-gemini-key");
  });

  it("sends the caller's prompt verbatim", async () => {
    const calls = capturePost(GEMINI_URL, () => geminiResponse({ questions: ["Q1"] }));

    await callGenerateJson("Discuss Blade Runner 2049 (2017).");

    expect(parseRequest(calls).contents[0]?.parts[0]?.text).toBe(
      "Discuss Blade Runner 2049 (2017).",
    );
  });

  it("asks Gemini for JSON constrained by the caller's response schema", async () => {
    const calls = capturePost(GEMINI_URL, () => geminiResponse({ questions: ["Q1"] }));

    await callGenerateJson();

    const request = parseRequest(calls);
    expect(request.generationConfig.responseMimeType).toBe("application/json");
    expect(request.generationConfig.responseSchema).toEqual(questionsResponseSchema);
  });

  it("forwards the temperature when the caller sets one", async () => {
    const calls = capturePost(GEMINI_URL, () => geminiResponse({ questions: ["Q1"] }));

    await generateJson({
      prompt: "anything",
      responseSchema: questionsResponseSchema,
      schema: questionsSchema,
      temperature: 0.4,
    });

    expect(parseRequest(calls).generationConfig.temperature).toBe(0.4);
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    // Force the key empty rather than calling vi.unstubAllEnvs(), which would
    // restore the ambient environment — unset locally but populated on CI
    // (Netlify injects the real secret), making the test non-deterministic.
    vi.stubEnv("GEMINI_API_KEY", "");

    await expect(callGenerateJson()).rejects.toThrow("GEMINI_API_KEY is not configured");
  });

  it("throws when the response contains no candidates", async () => {
    capturePost(GEMINI_URL, () => ({ candidates: [] }));

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the candidate content is missing text", async () => {
    capturePost(GEMINI_URL, () => ({ candidates: [{ content: { parts: [{}] } }] }));

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the JSON does not match the caller's schema", async () => {
    capturePost(GEMINI_URL, () => geminiResponse({ wrong: "shape" }));

    await expect(callGenerateJson()).rejects.toThrow("Gemini returned malformed JSON");
  });

  it("propagates API errors", async () => {
    capturePost(GEMINI_URL, () => HttpResponse.json({ error: "unavailable" }, { status: 503 }));

    await expect(callGenerateJson()).rejects.toThrow("Request failed with status code 503");
  });

  it("propagates transport failures", async () => {
    capturePost(GEMINI_URL, () => HttpResponse.error());

    await expect(callGenerateJson()).rejects.toThrow();
  });
});
