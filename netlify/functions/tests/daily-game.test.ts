/**
 * Integration tests for `netlify/functions/daily-game.ts` and the scheduled
 * catalog top-up that feeds it.
 *
 * The pool is the catalog alone, so movies get there through the real
 * scheduled function; only TMDB is faked, with credits chosen so the ranking
 * has a known shape.
 */
import { http, HttpResponse } from "msw";

import { type DailyGamePuzzle, type DailyGameWork } from "../../../lib/types/dailyGame";
import { handler } from "../daily-game";
import topUpCatalog from "../scheduled-daily-game-catalog";
import { tmdbMovie, tmdbPage } from "./fixtures/external";
import { signIn, type TestSession } from "./helpers/auth";
import { addWork, createClub, type SeededClub } from "./helpers/factories";
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

/** Fills the catalog with TMDB's `count` most-rated movies, ids from `firstId` up. */
async function seedCatalog(count: number, firstId = 100) {
  mostRated(1, count, firstId);
  await runCatalogTopUp();
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

const answerOf = (movies: DailyGameWork[]) => movies.find((movie) => movie.rank === 1);

describe("GET /api/daily-game/:clubType/:date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    tmdbPairs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ranks every movie in the catalog against one answer, without an account", async () => {
    await seedCatalog(12);

    const res = await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.date).toBe(TODAY);
    expect(res.body.puzzle).toBe(1);
    expect(res.body.works.map((movie) => movie.rank).sort((a, b) => a - b)).toStrictEqual(
      range(1, 12),
    );
    expect(new Set(res.body.works.map((movie) => movie.id))).toStrictEqual(
      new Set(range(100, 12).map(String)),
    );
  });

  it("ranks the answer's closest relative second, and says why", async () => {
    await seedCatalog(12);

    const { works: movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`))
      .body;

    const answer = answerOf(movies);
    const twinId = String(Number(answer?.id) ^ 1);
    const twin = movies.find((movie) => movie.id === twinId);
    expect(twin?.rank).toBe(2);
    expect(twin?.clues).toContain(
      `Same director: Director of pair ${Math.floor(Number(twinId) / 2)}`,
    );
    expect(answer?.clues).toStrictEqual([]);
  });

  it("names only major cast as clues, not bit parts every movie happens to share", async () => {
    server.use(
      http.get(`${TMDB}/movie/:movieId`, ({ params }) => {
        const base = tmdbMovie(Number(params.movieId));
        return HttpResponse.json(
          tmdbMovie(Number(params.movieId), {
            credits: {
              crew: base.credits?.crew ?? [],
              cast: [
                ...(base.credits?.cast ?? []),
                {
                  id: 9999,
                  name: "Background Extra",
                  character: "Diner patron",
                  order: 40,
                  profile_path: null,
                  popularity: 0.5,
                },
              ],
            },
          }),
        );
      }),
    );
    await seedCatalog(12);

    const { works } = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;

    expect(works.flatMap((work) => work.clues)).not.toContain("Also stars Background Extra");
  });

  it("leaves out movies clubs have added that aren't in the catalog", async () => {
    await seedCatalog(12);
    const alice = await signIn("alice");
    await addMovies(await createClub(alice), alice, range(200, 4));

    const { works: movies } = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`))
      .body;

    expect(movies.map((movie) => movie.id).sort()).toStrictEqual(range(100, 12).map(String));
  });

  it("keeps the day's answer while the catalog grows", async () => {
    await seedCatalog(12);
    const before = answerOf(
      (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body.works,
    );

    await seedCatalog(20);
    const after = await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`);

    expect(after.body.works).toHaveLength(20);
    expect(answerOf(after.body.works)?.id).toBe(before?.id);
  });

  it("numbers every calendar day, including days nobody played", async () => {
    await seedCatalog(12);
    const first = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;

    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    const later = (await api.get<DailyGamePuzzle>("/api/daily-game/movie/2026-10-25")).body;

    expect(first.puzzle).toBe(1);
    expect(later.puzzle).toBe(4);
    expect(answerOf(later.works)?.id).not.toBe(answerOf(first.works)?.id);
  });

  it("serves the dates a player somewhere could be on, and no further ahead", async () => {
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
    await seedCatalog(12);
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

    expect((await api.get(`/api/daily-game/movie/2026-10-23`)).statusCode).toBe(200);
    expect((await api.get(`/api/daily-game/movie/2026-10-21`)).statusCode).toBe(200);
    expect((await api.get(`/api/daily-game/movie/2026-10-24`)).statusCode).toBe(400);
    expect((await api.get(`/api/daily-game/movie/yesterday`)).statusCode).toBe(400);
  });

  it("has no puzzle for the day before the game began", async () => {
    await seedCatalog(12);

    expect((await api.get(`/api/daily-game/movie/2026-10-21`)).statusCode).toBe(404);
    const today = await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`);
    expect(today.body.puzzle).toBe(1);
  });

  it("refuses a date that isn't on the calendar", async () => {
    vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
    await seedCatalog(12);

    expect((await api.get(`/api/daily-game/movie/2026-02-31`)).statusCode).toBe(400);
  });

  it("only serves the club types that have a game", async () => {
    await seedCatalog(12);

    expect((await api.get(`/api/daily-game/book/${TODAY}`)).statusCode).toBe(404);
    expect((await api.get(`/api/daily-game/opera/${TODAY}`)).statusCode).toBe(400);
  });

  it("lets the CDN answer repeat requests for the day", async () => {
    await seedCatalog(12);

    const res = await api.get(`/api/daily-game/movie/${TODAY}`);

    expect(res.headers?.["Netlify-CDN-Cache-Control"]).toContain("s-maxage");
  });

  it("waits until the catalog holds enough movies to play", async () => {
    await seedCatalog(3);

    const res = await api.get(`/api/daily-game/movie/${TODAY}`);

    expect(res.statusCode).toBe(404);
  });

  it("is playable before the catalog job has ever run, from one page of TMDB", async () => {
    mostRated(3, 20);

    const first = await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`);
    failOnRequest("get", `${TMDB}/discover/movie`);
    const again = await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`);

    expect(first.statusCode).toBe(200);
    expect(first.body.puzzle).toBe(1);
    expect(first.body.works).toHaveLength(20);
    expect(answerOf(again.body.works)?.id).toBe(answerOf(first.body.works)?.id);
  });

  describe("topping up the catalog from TMDB", () => {
    it("fills a large catalog over several runs without fetching a movie twice", async () => {
      mostRated(4, 20);

      await runCatalogTopUp();
      const first = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;
      expect(first.works).toHaveLength(50);

      failOnRequest(
        "get",
        new RegExp(`${TMDB}/movie/(${first.works.map((m) => m.id).join("|")})$`),
      );
      await runCatalogTopUp();
      const second = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;
      expect(second.works).toHaveLength(80);
      expect(answerOf(second.works)?.id).toBe(answerOf(first.works)?.id);
    });

    it("keeps reading TMDB when one of its pages fails", async () => {
      mostRated(2, 10);
      server.use(
        http.get(`${TMDB}/discover/movie`, ({ request }) =>
          new URL(request.url).searchParams.get("page") === "1"
            ? new HttpResponse(null, { status: 500 })
            : undefined,
        ),
      );
      await runCatalogTopUp();

      const { works } = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;

      expect(works.map((movie) => movie.id).sort()).toStrictEqual(range(510, 10).map(String));
    });

    it("once full, looks for new releases once a day rather than every hour", async () => {
      vi.useRealTimers();
      const filledAt = new Date();
      vi.useFakeTimers({ toFake: ["Date"] });
      mostRated(1, 12);
      await runCatalogTopUp();

      const nextHour = (hours: number) => new Date(filledAt.getTime() + hours * 60 * 60 * 1000);
      let later = nextHour(3);
      if (later.getUTCHours() === 4) later = nextHour(4);
      vi.setSystemTime(later);
      mostRated(1, 13);
      await runCatalogTopUp();
      const today = later.toISOString().slice(0, 10);
      const hourly = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${today}`)).body;
      expect(hourly.works).toHaveLength(12);

      const sweep = new Date(later);
      sweep.setUTCDate(sweep.getUTCDate() + 1);
      sweep.setUTCHours(4, 0, 0, 0);
      vi.setSystemTime(sweep);
      await runCatalogTopUp();
      const nextDay = sweep.toISOString().slice(0, 10);
      const daily = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${nextDay}`)).body;
      expect(daily.works).toHaveLength(13);
    });

    it("skips a movie TMDB fails to return and adds it on a later run", async () => {
      mostRated(1, 12);
      server.use(http.get(`${TMDB}/movie/505`, () => new HttpResponse(null, { status: 500 })));
      await runCatalogTopUp();
      const before = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;
      expect(before.works.map((movie) => movie.id)).not.toContain("505");

      server.resetHandlers();
      tmdbPairs();
      mostRated(1, 12);
      await runCatalogTopUp();
      const after = (await api.get<DailyGamePuzzle>(`/api/daily-game/movie/${TODAY}`)).body;
      expect(after.works.map((movie) => movie.id)).toContain("505");
    });
  });
});
