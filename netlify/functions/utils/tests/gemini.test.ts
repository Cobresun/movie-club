/**
 * Tests for netlify/functions/utils/gemini.ts
 *
 * axios is mocked so no real HTTP calls are made.
 * GEMINI_API_KEY is provided/removed via vi.stubEnv.
 */
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("axios");

// Schema for the Gemini request body captured from the axios mock — typed
// extraction without `as` casts.
const geminiRequestSchema = z.object({
  contents: z.array(z.object({ parts: z.array(z.object({ text: z.string() })) })),
  generationConfig: z.object({
    temperature: z.number().optional(),
    responseMimeType: z.string(),
    responseSchema: z.record(z.unknown()),
  }),
});

function parseRequest(body: unknown) {
  return geminiRequestSchema.parse(body);
}

async function importGemini() {
  const mod = await import("../gemini");
  return mod;
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

/** The shape callers most commonly ask Gemini for: `{ questions: string[] }`. */
const questionsSchema = z.object({ questions: z.array(z.string()) });

const questionsResponseSchema = {
  type: "object",
  properties: { questions: { type: "array", items: { type: "string" } } },
  required: ["questions"],
};

function makeGeminiResponse(payload: unknown) {
  return {
    data: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] },
    status: 200,
  };
}

function callGenerateJson(
  generateJson: Awaited<ReturnType<typeof importGemini>>["generateJson"],
  prompt = "Generate discussion prompts for Inception.",
) {
  return generateJson({
    prompt,
    responseSchema: questionsResponseSchema,
    schema: questionsSchema,
  });
}

// ─── generateJson ─────────────────────────────────────────────────────────────

describe("generateJson", () => {
  const axiosPostMock = vi.mocked(axios.post);

  it("returns the parsed payload from a well-formed Gemini response", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(
      makeGeminiResponse({
        questions: ["Was the ending inevitable?", "What does the spinning top symbolise?"],
      }),
    );

    const result = await callGenerateJson(generateJson);

    expect(result.questions).toEqual([
      "Was the ending inevitable?",
      "What does the spinning top symbolise?",
    ]);
  });

  it("accepts an empty collection when the caller's schema allows it", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ questions: [] }));

    const result = await callGenerateJson(generateJson);

    expect(result.questions).toEqual([]);
  });

  it("posts to the Gemini endpoint with the api key in the URL", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ questions: ["Q1"] }));

    await callGenerateJson(generateJson);

    const calledUrl = axiosPostMock.mock.calls[0]?.[0] ?? "";
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
    expect(calledUrl).toContain("key=test-gemini-key");
  });

  it("sends the caller's prompt verbatim", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ questions: ["Q1"] }));

    await callGenerateJson(generateJson, "Discuss Blade Runner 2049 (2017).");

    const request = parseRequest(axiosPostMock.mock.calls[0]?.[1]);
    expect(request.contents[0]?.parts[0]?.text).toBe("Discuss Blade Runner 2049 (2017).");
  });

  it("asks Gemini for JSON constrained by the caller's response schema", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ questions: ["Q1"] }));

    await callGenerateJson(generateJson);

    const request = parseRequest(axiosPostMock.mock.calls[0]?.[1]);
    expect(request.generationConfig.responseMimeType).toBe("application/json");
    expect(request.generationConfig.responseSchema).toEqual(questionsResponseSchema);
  });

  it("forwards the temperature when the caller sets one", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ questions: ["Q1"] }));

    await generateJson({
      prompt: "anything",
      responseSchema: questionsResponseSchema,
      schema: questionsSchema,
      temperature: 0.4,
    });

    const request = parseRequest(axiosPostMock.mock.calls[0]?.[1]);
    expect(request.generationConfig.temperature).toBe(0.4);
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    // Force the key empty rather than calling vi.unstubAllEnvs(), which would
    // restore the ambient environment — unset locally but populated on CI
    // (Netlify injects the real secret), making the test non-deterministic.
    vi.stubEnv("GEMINI_API_KEY", "");
    const { generateJson } = await importGemini();

    await expect(callGenerateJson(generateJson)).rejects.toThrow(
      "GEMINI_API_KEY is not configured",
    );
  });

  it("throws when the response contains no candidates", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce({ data: { candidates: [] }, status: 200 });

    await expect(callGenerateJson(generateJson)).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the candidate content is missing text", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{}] } }] },
      status: 200,
    });

    await expect(callGenerateJson(generateJson)).rejects.toThrow("Gemini returned no text content");
  });

  it("throws when the JSON does not match the caller's schema", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse({ wrong: "shape" }));

    await expect(callGenerateJson(generateJson)).rejects.toThrow("Gemini returned malformed JSON");
  });

  it("propagates axios network errors", async () => {
    const { generateJson } = await importGemini();
    axiosPostMock.mockRejectedValueOnce(new Error("network timeout"));

    await expect(callGenerateJson(generateJson)).rejects.toThrow("network timeout");
  });
});
