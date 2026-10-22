/**
 * Integration tests for `netlify/functions/daily-game.ts`.
 *
 * The pool is whatever clubs have added, so movies are added through the real
 * list endpoints; only TMDB is faked, with credits chosen so the ranking has a
 * known shape.
 */
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyGameMovie, DailyGamePuzzle } from "../../../lib/types/dailyGame";
import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { handler } from "../daily-game";
import { tmdbMovie } from "./fixtures/external";
import { signIn, TestSession } from "./helpers/auth";
import { addWork, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";
import { server, TMDB } from "./setup/externalApis";

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
});
