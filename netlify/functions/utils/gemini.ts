import axios from "axios";
import { z } from "zod";

import { hasValue } from "../../../lib/checks/checks.js";

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const questionsSchema = z.object({
  questions: z.array(z.string().min(1)).min(3).max(5),
});

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

export async function generateDiscussionQuestions(
  title: string,
  releaseYear?: string,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasValue(apiKey)) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const filmLabel = hasValue(releaseYear) ? `${title} (${releaseYear})` : title;
  const prompt = `Generate 3 to 5 thought-provoking discussion questions for a movie club discussing the film "${filmLabel}". The questions should encourage interpretation, debate, and personal reflection rather than plot recall. Avoid yes/no questions.`;

  const response = await axios.post<GeminiResponse>(
    `${GEMINI_ENDPOINT}?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 5,
            },
          },
          required: ["questions"],
        },
      },
    },
  );

  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!hasValue(rawText)) {
    throw new Error("Gemini returned no text content");
  }

  const parsed = questionsSchema.safeParse(JSON.parse(rawText));
  if (!parsed.success) {
    throw new Error(`Gemini returned malformed JSON: ${parsed.error.message}`);
  }

  return parsed.data.questions;
}
