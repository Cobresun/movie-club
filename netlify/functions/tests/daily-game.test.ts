/**
 * Integration tests for `netlify/functions/daily-game.ts` and the scheduled
 * catalog top-up that feeds it.
 *
 * The pool is whatever clubs have added plus the catalog, so movies get there
 * through the real list endpoints and the real scheduled function; only TMDB
 * is faked, with credits chosen so the ranking has a known shape.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyGameMovie, DailyGamePuzzle } from "../../../lib/types/dailyGame";
import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { handler } from "../daily-game";
import topUpCatalog from "../scheduled-daily-game-catalog";
import { tmdbMovie, tmdbPage } from "./fixtures/external";
import { signIn, TestSession } from "./helpers/auth";
import { addWork, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";
import { failOnRequest, server, TMDB } from "./setup/externalApis";

const api = requester(handler);

const TODAY = "2026-10-22";

/**
 * Movies come in pairs that share a director and nothing else (TMDB's
 * fixture otherwise gives each movie its own director, cast and studio), so
 * whichever movie is drawn as the answer, its twin is the closest guess.
 */
function tmdbPairs() {
  server.use(
    http.get(`${TMDB}/movie/:movieId`, ({ params }) => {
      const id = Number(params.movieId);
      const pair = Math.floor(id / 2);
      const base = tmdbMovie(id);
      return HttpResponse.json(
        tmdbMovie(id, {
          release_date: `${1950 + pair * 7}-01-01`,
          credits: {
            cast: base.credits?.cast ?? [],
            crew: [
              {
                id: pair,
                name: `Director of pair ${pair}`,
                job: "Director",
                department: "Directing",
                profile_path: null,
              },
            ],
          },
        }),
      );
    }),
  );
}

async function addMovies(club: SeededClub, session: TestSession, ids: number[]) {
  for (const id of ids) {
    await addWork(club, session, { externalId: String(id), title: `Movie ${id}` });
  }
}

/** TMDB's most-rated list: `perPage` movies on each of the first `pages` pages, then nothing. */
function mostRated(pages: number, perPage: number, firstId = 500) {
  server.use(
    http.get(`${TMDB}/discover/movie`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      const ids = page <= pages ? range(firstId + (page - 1) * perPage, perPage) : [];
      return HttpResponse.json(tmdbPage(ids.map((id) => tmdbMovie(id))));
    }),
  );
}

async function runCatalogTopUp() {
  const response = await topUpCatalog(
    new Request("https://localhost/.netlify/functions/scheduled-daily-game-catalog", {
      method: "POST",
      body: JSON.stringify({ next_run: "2026-10-22T13:00:00Z" }),
    }),
  );
  expect(response.status).toBe(200);
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

const answerOf = (movies: DailyGameMovie[]) => movies.find((movie) => movie.rank === 1);

describe("GET /api/daily-game/:date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    tmdbPairs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ranks every movie the clubs have added against one answer, without an account", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 12));

    const res = await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.date).toBe(TODAY);
    expect(res.body.puzzle).toBe(1);
    expect(res.body.movies.map((movie) => movie.rank).sort((a, b) => a - b)).toEqual(range(1, 12));
    expect(new Set(res.body.movies.map((movie) => movie.id))).toEqual(
      new Set(range(100, 12).map(String)),
    );
  });

  it("ranks the answer's closest relative second, and says why", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 12));

    const { movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;

    const answer = answerOf(movies);
    const twinId = String(Number(answer?.id) ^ 1);
    const twin = movies.find((movie) => movie.id === twinId);
    expect(twin?.rank).toBe(2);
    expect(twin?.clues).toContain(
      `Same director: Director of pair ${Math.floor(Number(twinId) / 2)}`,
    );
    expect(answer?.clues).toEqual([]);
  });

  it("pools movies across clubs, once each", async () => {
    const alice = await signIn("alice");
    const bob = await signIn("bob");
    await addMovies(await createClub(alice), alice, range(100, 10));
    await addMovies(await createClub(bob), bob, range(106, 6));

    const { movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;

    expect(movies.map((movie) => movie.id).sort()).toEqual(range(100, 12).map(String));
  });

  it("leaves books out of the pool", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 10));
    const bookClub = await createClub(alice, { type: ClubType.book });
    await addWork(bookClub, alice, { type: WorkType.book, externalId: "book-1", title: "A Book" });

    const { movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;

    expect(movies.map((movie) => movie.title)).not.toContain("A Book");
  });

  it("keeps the day's answer while clubs keep adding movies", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addMovies(club, alice, range(100, 12));
    const before = answerOf(
      (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body.movies,
    );

    await addMovies(club, alice, range(112, 8));
    const after = await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`);

    expect(after.body.movies).toHaveLength(20);
    expect(answerOf(after.body.movies)?.id).toBe(before?.id);
  });

  it("numbers each new day and doesn't repeat an answer", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 12));
    const first = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;

    vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    const second = (await api.get<DailyGamePuzzle>("/api/daily-game/2026-10-23")).body;

    expect(second.puzzle).toBe(2);
    expect(answerOf(second.movies)?.id).not.toBe(answerOf(first.movies)?.id);
  });

  it("serves the dates a player somewhere could be on, and no further ahead", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 12));

    expect((await api.get(`/api/daily-game/2026-10-23`)).statusCode).toBe(200);
    expect((await api.get(`/api/daily-game/2026-10-21`)).statusCode).toBe(200);
    expect((await api.get(`/api/daily-game/2026-10-24`)).statusCode).toBe(400);
    expect((await api.get(`/api/daily-game/yesterday`)).statusCode).toBe(400);
  });

  it("waits until clubs have added enough movies to play", async () => {
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(100, 3));

    const res = await api.get(`/api/daily-game/${TODAY}`);

    expect(res.statusCode).toBe(404);
  });

  describe("with the catalog topped up from TMDB", () => {
    it("plays from TMDB's most-rated movies before any club has added one", async () => {
      mostRated(1, 12);
      await runCatalogTopUp();

      const res = await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.movies.map((movie) => movie.id).sort()).toEqual(range(500, 12).map(String));
    });

    it("pools the catalog with the clubs' movies, once each", async () => {
      const alice = await signIn("alice");
      await addMovies(await createClub(alice), alice, range(100, 4));
      mostRated(1, 10, 102);
      await runCatalogTopUp();

      const { movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;

      expect(movies.map((movie) => movie.id).sort()).toEqual(range(100, 12).map(String));
    });

    it("fills a large catalog over several runs without fetching a movie twice", async () => {
      mostRated(4, 20);

      await runCatalogTopUp();
      const first = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;
      expect(first.movies).toHaveLength(50);

      failOnRequest(
        "get",
        new RegExp(`${TMDB}/movie/(${first.movies.map((m) => m.id).join("|")})$`),
      );
      await runCatalogTopUp();
      const second = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;
      expect(second.movies).toHaveLength(80);
      expect(answerOf(second.movies)?.id).toBe(answerOf(first.movies)?.id);
    });

    it("skips a movie TMDB fails to return and adds it on a later run", async () => {
      mostRated(1, 12);
      server.use(http.get(`${TMDB}/movie/505`, () => new HttpResponse(null, { status: 500 })));
      await runCatalogTopUp();
      const before = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;
      expect(before.movies.map((movie) => movie.id)).not.toContain("505");

      server.resetHandlers();
      tmdbPairs();
      mostRated(1, 12);
      await runCatalogTopUp();
      const after = (await api.get<DailyGamePuzzle>(`/api/daily-game/${TODAY}`)).body;
      expect(after.movies.map((movie) => movie.id)).toContain("505");
    });
  });
});
