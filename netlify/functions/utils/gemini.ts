import axios from "axios";
import { z } from "zod";

import { hasElements, hasValue } from "../../../lib/checks/checks.js";

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const questionsSchema = z.object({
  questions: z.array(z.string().min(1)).max(5),
});

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

interface MovieWork {
  type: "movie";
  title: string;
  releaseYear?: string;
}

interface BookWork {
  type: "book";
  title: string;
  authors?: string[];
  firstPublishYear?: string;
}

/**
 * The minimal, source-resolved metadata needed to prompt for discussion
 * questions. Built server-side in the reviews handler so client input can't
 * poison the prompt.
 */
export type DiscussionWork = MovieWork | BookWork;

function buildMoviePrompt(work: MovieWork): string {
  const label = hasValue(work.releaseYear)
    ? `${work.title} (${work.releaseYear})`
    : work.title;
  return `Generate 3 to 5 discussion prompts for a movie club rewatching "${label}". Every prompt must be specific to THIS film — naming its actual characters, scenes, lines, or moments — never a generic question that could apply to any movie.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial — a real book-club-worthy question, adapted for film.

Whenever the film supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this film or cannot confirm it is a real movie, return 0 questions.`;
}

function buildBookPrompt(work: BookWork): string {
  const byline = hasElements(work.authors)
    ? ` by ${work.authors.join(" and ")}`
    : "";
  const yearSuffix = hasValue(work.firstPublishYear)
    ? ` (${work.firstPublishYear})`
    : "";
  return `Generate 3 to 5 discussion prompts for a book club discussing "${work.title}"${byline}${yearSuffix}. Every prompt must be specific to THIS book — naming its actual characters, plot points, themes, or passages — never a generic question that could apply to any book.

Order the prompts by depth: the first should be casual and easy to answer — a low-stakes entry point. Each subsequent prompt should be more thought-provoking than the last, with the final one being substantial — a real book-club-worthy question.

Whenever the book supports it, frame prompts as debates: questions with defensible answers on more than one side, designed to spark disagreement among friends rather than consensus. Keep each prompt succinct — one clear, concise question with no preamble.

If you do not recognize this book or cannot confirm it is a real book, return 0 questions.`;
}

function buildPrompt(work: DiscussionWork): string {
  return work.type === "book" ? buildBookPrompt(work) : buildMoviePrompt(work);
}

export async function generateDiscussionQuestions(
  work: DiscussionWork,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!hasValue(apiKey)) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = buildPrompt(work);

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
