import axios, { isAxiosError, type AxiosResponse } from "axios";
import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";

// Flash-Lite rather than full Flash: the larger Flash models shed load with
// 503s often enough to fail most requests, and answer too slowly for a
// function timeout when they do succeed.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Gemini's 503 "high demand" responses usually clear within a second.
const RETRY_DELAYS_MS = [250, 750];

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

const geminiErrorSchema = z.object({ error: z.object({ message: z.string() }) });

interface GenerateJsonOptions<T> {
  prompt: string;
  /** OpenAPI-style structured-output schema enforced by Gemini server-side. */
  responseSchema: Record<string, unknown>;
  /** Validates the JSON Gemini returns and types the result. */
  schema: z.ZodType<T>;
  temperature?: number;
}

/**
 * Generic Gemini call: send a prompt with a structured-output schema, get back
 * validated JSON. Callers own their prompts and schemas — this module knows
 * nothing about what is being generated.
 */
export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasValue(apiKey)) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await post(apiKey, {
    contents: [{ parts: [{ text: options.prompt }] }],
    generationConfig: {
      temperature: options.temperature,
      responseMimeType: "application/json",
      responseSchema: options.responseSchema,
    },
  });

  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!hasValue(rawText)) {
    throw new Error("Gemini returned no text content");
  }

  const parsed = options.schema.safeParse(JSON.parse(rawText));
  if (!parsed.success) {
    throw new Error(`Gemini returned malformed JSON: ${parsed.error.message}`);
  }

  return parsed.data;
}

async function post(
  apiKey: string,
  body: unknown,
  attempt = 0,
): Promise<AxiosResponse<GeminiResponse>> {
  try {
    return await axios.post<GeminiResponse>(GEMINI_ENDPOINT, body, {
      headers: { "x-goog-api-key": apiKey },
    });
  } catch (error) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (isAxiosError(error) && error.response?.status === 503 && delay !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return post(apiKey, body, attempt + 1);
    }
    throw toGeminiError(error);
  }
}

// An AxiosError carries the request config and socket, headers included, and
// the router logs thrown errors whole — so it must not escape with the key
// inside. Rethrow a plain Error naming only the status and Google's reason.
function toGeminiError(error: unknown): Error {
  if (!isAxiosError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (error.response === undefined) {
    return new Error(`Gemini request failed: ${error.message}`);
  }
  const parsed = geminiErrorSchema.safeParse(error.response.data);
  const reason = parsed.success ? parsed.data.error.message : error.message;
  return new Error(`Gemini request failed with status ${error.response.status}: ${reason}`);
}
