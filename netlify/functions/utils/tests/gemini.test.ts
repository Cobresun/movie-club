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
  contents: z.array(
    z.object({ parts: z.array(z.object({ text: z.string() })) }),
  ),
});

function extractPromptText(body: unknown): string {
  return geminiRequestSchema.parse(body).contents[0]?.parts[0]?.text ?? "";
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

function makeGeminiResponse(questions: string[]) {
  return {
    data: {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ questions }) }],
          },
        },
      ],
    },
    status: 200,
  };
}

// ─── generateDiscussionQuestions ──────────────────────────────────────────────

describe("generateDiscussionQuestions", () => {
  const axiosPostMock = vi.mocked(axios.post);

  it("returns questions from a well-formed Gemini response", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(
      makeGeminiResponse([
        "Was the ending inevitable?",
        "What does the spinning top symbolise?",
      ]),
    );

    const result = await generateDiscussionQuestions("Inception", "2010");

    expect(result).toEqual([
      "Was the ending inevitable?",
      "What does the spinning top symbolise?",
    ]);
  });

  it("returns an empty array when Gemini returns zero questions", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse([]));

    const result = await generateDiscussionQuestions("Unknown Film");

    expect(result).toEqual([]);
  });

  it("posts to the correct Gemini endpoint with the api_key in the URL", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse(["Q1"]));

    await generateDiscussionQuestions("Inception");

    const calledUrl = axiosPostMock.mock.calls[0]?.[0] ?? "";
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
    expect(calledUrl).toContain("key=test-gemini-key");
  });

  it("includes the film title in the prompt body", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse(["Q1"]));

    await generateDiscussionQuestions("Blade Runner 2049", "2017");

    const promptText = extractPromptText(axiosPostMock.mock.calls[0]?.[1]);
    expect(promptText).toContain("Blade Runner 2049 (2017)");
  });

  it("omits the year from the label when releaseYear is not provided", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce(makeGeminiResponse(["Q1"]));

    await generateDiscussionQuestions("Dune");

    const promptText = extractPromptText(axiosPostMock.mock.calls[0]?.[1]);
    expect(promptText).toContain('"Dune"');
    expect(promptText).not.toMatch(/\(\d{4}\)/);
  });

  it("throws when GEMINI_API_KEY is not set", async () => {
    vi.unstubAllEnvs();
    const { generateDiscussionQuestions } = await importGemini();

    await expect(generateDiscussionQuestions("Inception")).rejects.toThrow(
      "GEMINI_API_KEY is not configured",
    );
  });

  it("throws when the response contains no candidates", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce({
      data: { candidates: [] },
      status: 200,
    });

    await expect(generateDiscussionQuestions("Inception")).rejects.toThrow(
      "Gemini returned no text content",
    );
  });

  it("throws when the candidate content is missing text", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce({
      data: { candidates: [{ content: { parts: [{}] } }] },
      status: 200,
    });

    await expect(generateDiscussionQuestions("Inception")).rejects.toThrow(
      "Gemini returned no text content",
    );
  });

  it("throws when Gemini returns malformed JSON", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockResolvedValueOnce({
      data: {
        candidates: [{ content: { parts: [{ text: '{"wrong":"shape"}' }] } }],
      },
      status: 200,
    });

    await expect(generateDiscussionQuestions("Inception")).rejects.toThrow(
      "Gemini returned malformed JSON",
    );
  });

  it("propagates axios network errors", async () => {
    const { generateDiscussionQuestions } = await importGemini();
    axiosPostMock.mockRejectedValueOnce(new Error("network timeout"));

    await expect(generateDiscussionQuestions("Inception")).rejects.toThrow(
      "network timeout",
    );
  });
});
