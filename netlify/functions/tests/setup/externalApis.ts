import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";

import { geminiJsonResponse, googleBooksVolume, tmdbConfig, tmdbMovie } from "../fixtures/external";

/**
 * The only thing the integration suite fakes: the third-party HTTP APIs.
 *
 * Everything below the network — routers, middleware, repositories, Kysely,
 * BetterAuth — runs for real against a live CockroachDB. Intercepting at the
 * boundary rather than with `vi.mock` means `utils/tmdb.ts`,
 * `providers/googleBooks.ts`, `utils/gemini.ts`, `utils/email.ts` and the
 * Cloudinary SDK all execute their real request-building and response-parsing
 * code, so a test can catch a bug in any of it.
 *
 * `onUnhandledRequest: "error"` (see `integration.ts`) means a handler reaching
 * an unmocked host fails the test instead of hitting the internet.
 */

export const TMDB = "https://api.themoviedb.org/3";
export const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1";
// The Gemini path ends in `models/<model>:generateContent`; the colon would be
// read as a path parameter by MSW's matcher, so match the host instead.
const GEMINI = /generativelanguage\.googleapis\.com/;

const CLOUDINARY = "https://api.cloudinary.com/v1_1/:cloud";
export const CLOUDINARY_UPLOAD = `${CLOUDINARY}/image/upload`;
export const CLOUDINARY_DESTROY = `${CLOUDINARY}/image/destroy`;

export interface SentEmail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Emails BetterAuth handed to Resend during the current test. Cleared before
 * each test.
 *
 * This is the test suite's inbox: `helpers/auth.ts` confirms a new account by
 * following the link out of the verification email, exactly as a user would,
 * rather than flipping `emailVerified` in the database.
 */
export const sentEmails: SentEmail[] = [];

const resendPayloadSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string(),
  html: z.string(),
});

export const server = setupServer(
  http.get(`${TMDB}/configuration`, () => HttpResponse.json(tmdbConfig())),

  http.get(`${TMDB}/movie/:movieId`, ({ params }) =>
    HttpResponse.json(tmdbMovie(Number(params.movieId))),
  ),

  http.get(`${GOOGLE_BOOKS}/volumes/:volumeId`, ({ params }) =>
    HttpResponse.json(googleBooksVolume(String(params.volumeId))),
  ),

  http.get(`${GOOGLE_BOOKS}/volumes`, ({ request }) => {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return HttpResponse.json({ totalItems: 1, items: [googleBooksVolume(`vol-${query}`)] });
  }),

  http.post(GEMINI, () =>
    HttpResponse.json(
      geminiJsonResponse({
        questions: ["What did you make of the ending?", "Who was the villain?"],
      }),
    ),
  ),

  // Resend, reached through the SDK by BetterAuth's verification and
  // password-reset emails. The payload is kept so tests (and the sign-up
  // fixture) can read what was actually sent.
  http.post("https://api.resend.com/emails", async ({ request }) => {
    const payload = resendPayloadSchema.parse(await request.json());
    sentEmails.push({
      to: Array.isArray(payload.to) ? payload.to[0] : payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return HttpResponse.json({ id: "test-email-id" });
  }),

  // Cloudinary avatar upload / delete.
  http.post(CLOUDINARY_UPLOAD, () =>
    HttpResponse.json({
      secure_url: "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg",
      public_id: "avatar-public-id",
    }),
  ),
  http.post(CLOUDINARY_DESTROY, () => HttpResponse.json({ result: "ok" })),
);

/**
 * Makes any matching request blow up for the rest of the current test.
 *
 * This is how the suite says "this endpoint must not be reached" — for a cache
 * that should spare a second fetch, or a cleanup that has nothing to clean up.
 * Asserting on a log of intercepted requests would instead couple the test to
 * the calls a handler happens to make, which is the thing the integration
 * suite is trying not to care about.
 */
export function failOnRequest(method: "get" | "post" | "delete", path: string | RegExp) {
  server.use(
    http[method](path, ({ request }) => {
      throw new Error(`Unexpected request to ${request.method} ${request.url}`);
    }),
  );
}

/** The most recent email sent to `address`, or undefined if there is none. */
export function lastEmailTo(address: string): SentEmail | undefined {
  return sentEmails.filter((email) => email.to === address).at(-1);
}
