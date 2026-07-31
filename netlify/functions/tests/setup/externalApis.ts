import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

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

const TMDB = "https://api.themoviedb.org/3";
const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1";
// The Gemini path ends in `models/<model>:generateContent`; the colon would be
// read as a path parameter by MSW's matcher, so match the host instead.
const GEMINI = /generativelanguage\.googleapis\.com/;

/**
 * Every request MSW intercepted during the current test, so a test can assert
 * on cache behaviour ("re-adding a known movie makes no second TMDB call")
 * rather than just on the response body. Cleared before each test.
 */
export const externalRequests: { method: string; url: string }[] = [];

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
  // password-reset emails.
  http.post("https://api.resend.com/emails", () => HttpResponse.json({ id: "test-email-id" })),

  // Cloudinary avatar upload / delete.
  http.post("https://api.cloudinary.com/v1_1/:cloud/image/upload", () =>
    HttpResponse.json({
      secure_url: "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg",
      public_id: "avatar-public-id",
    }),
  ),
  http.post("https://api.cloudinary.com/v1_1/:cloud/image/destroy", () =>
    HttpResponse.json({ result: "ok" }),
  ),
);

server.events.on("request:start", ({ request }) => {
  externalRequests.push({ method: request.method, url: request.url });
});

/** Requests made to `host` during this test, most recent last. */
export function requestsTo(host: string) {
  return externalRequests.filter((request) => request.url.includes(host));
}
