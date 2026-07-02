import axios from "axios";
import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

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
export async function generateJson<T>(
  options: GenerateJsonOptions<T>,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasValue(apiKey)) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await axios.post<GeminiResponse>(
    `${GEMINI_ENDPOINT}?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature,
        responseMimeType: "application/json",
        responseSchema: options.responseSchema,
      },
    },
  );

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
