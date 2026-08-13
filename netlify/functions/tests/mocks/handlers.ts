import { HttpResponse, http } from "msw";

import { geminiJsonResponse, googleBooksVolume, tmdbConfig, tmdbMovie } from "../fixtures/external";

/**
 * Default responses for every third-party endpoint the backend calls, in the
 * same shape as the client project's `src/mocks/handlers.ts`: a happy-path
 * body per URL, which a test overrides with `server.use(...)` when it needs a
 * different one.
 *
 * The module under test keeps its real axios — only the network is faked — so
 * request building, response parsing and error handling all execute for real.
 * Bodies are derived from the requested id or query, which is what lets a test
 * assert on the returned value alone: `Book abc` can only come back if `abc`
 * was the id that went on the wire.
 */

const TMDB = "https://api.themoviedb.org/3";
const GOOGLE_BOOKS = "https://www.googleapis.com/books/v1";
// The Gemini path ends in `models/<model>:generateContent`; the colon would be
// read as a path parameter by MSW's matcher, so match the host instead.
const GEMINI = /generativelanguage\.googleapis\.com/;

/** The questions the default Gemini handler answers `generateJson` with. */
export const GEMINI_QUESTIONS = ["What did you make of the ending?", "Who was the villain?"];

export const handlers = [
  http.get(`${TMDB}/configuration`, () => HttpResponse.json(tmdbConfig())),

  http.get(`${TMDB}/movie/:movieId`, ({ params }) =>
    HttpResponse.json(tmdbMovie(Number(params.movieId))),
  ),

  http.get(`${GOOGLE_BOOKS}/volumes/:volumeId`, ({ params, request }) => {
    const keylessError = googleBooksKeylessError(request);
    if (keylessError) return keylessError;
    return HttpResponse.json(googleBooksVolume(String(params.volumeId)));
  }),

  http.get(`${GOOGLE_BOOKS}/volumes`, ({ request }) => {
    const keylessError = googleBooksKeylessError(request);
    if (keylessError) return keylessError;
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return HttpResponse.json({ totalItems: 1, items: [googleBooksVolume(`vol-${query}`)] });
  }),

  http.post(GEMINI, () => HttpResponse.json(geminiJsonResponse({ questions: GEMINI_QUESTIONS }))),
];

/**
 * Google Books allows keyless requests at a low rate limit but rejects a `key`
 * param sent with an empty value, which is why the provider omits the param
 * entirely when `GOOGLE_BOOKS_API_KEY` is unset. Reproducing the 400 here keeps
 * that a test can catch: a regression surfaces as a rejected call, not as a
 * request assertion.
 */
function googleBooksKeylessError(request: Request) {
  if (new URL(request.url).searchParams.get("key") !== "") return undefined;
  return HttpResponse.json(
    { error: { code: 400, message: "API key not valid. Please pass a valid API key." } },
    { status: 400 },
  );
}
