/**
 * Integration tests for `netlify/functions/scheduled-work-refresh.ts` — the
 * daily sweep that re-fetches the oldest cached metadata for every media
 * provider.
 *
 * The whole point of this job is that it rewrites rows, so it is only
 * meaningful against a real database: the assertions here read the refreshed
 * `movie_details` / `book_details` rows back.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import refreshHandler from "../scheduled-work-refresh";
import { googleBooksVolume, tmdbMovie } from "./fixtures/external";
import { db } from "./helpers/database";
import { cacheMovieDetails } from "./helpers/factories";
import { requestsTo, server } from "./setup/externalApis";

function scheduledRequest(body: unknown) {
  return new Request("https://localhost/.netlify/functions/scheduled-work-refresh", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function run() {
  return refreshHandler(scheduledRequest({ next_run: "2026-01-01T00:00:00Z" }));
}

async function cacheBook(externalId: string, overrides: { title?: string; author?: string } = {}) {
  await db
    .insertInto("book_details")
    .values({ external_id: externalId, title: overrides.title ?? "Old Title" })
    .execute();
  await db
    .insertInto("book_authors")
    .values({ external_id: externalId, author_name: overrides.author ?? "Old Author" })
    .execute();
}

describe("scheduled work refresh", () => {
  it("rewrites cached movie details from TMDB", async () => {
    await cacheMovieDetails("42", { title: "Stale Title", tagline: "Stale tagline" });
    server.use(
      http.get("https://api.themoviedb.org/3/movie/42", () =>
        HttpResponse.json(tmdbMovie(42, { title: "Fresh Title", tagline: "Fresh tagline" })),
      ),
    );

    const response = await run();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, processed: 1, updated: 1 });

    const row = await db
      .selectFrom("movie_details")
      .select(["title", "tagline"])
      .where("external_id", "=", "42")
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ title: "Fresh Title", tagline: "Fresh tagline" });
  });

  it("replaces the cast rather than appending to it", async () => {
    await cacheMovieDetails("42");
    server.use(
      http.get("https://api.themoviedb.org/3/movie/42", () =>
        HttpResponse.json(
          tmdbMovie(42, {
            credits: {
              cast: [
                {
                  id: 1,
                  name: "Only Actor",
                  character: "Only Role",
                  order: 0,
                  profile_path: null,
                  popularity: 3,
                },
              ],
              crew: [],
            },
          }),
        ),
      ),
    );

    await run();

    const actors = await db
      .selectFrom("movie_actors")
      .select("actor_name")
      .where("external_id", "=", "42")
      .execute();
    expect(actors).toEqual([{ actor_name: "Only Actor" }]);
  });

  it("refreshes book details and their authors", async () => {
    await cacheBook("bookvolume");
    server.use(
      http.get("https://www.googleapis.com/books/v1/volumes/bookvolume", () =>
        HttpResponse.json(
          googleBooksVolume("bookvolume", { title: "Fresh Book", authors: ["Fresh Author"] }),
        ),
      ),
    );

    const response = await run();

    expect(await response.json()).toMatchObject({ success: true, processed: 1, updated: 1 });
    const book = await db
      .selectFrom("book_details")
      .select("title")
      .where("external_id", "=", "bookvolume")
      .executeTakeFirstOrThrow();
    expect(book.title).toBe("Fresh Book");
    const authors = await db
      .selectFrom("book_authors")
      .select("author_name")
      .where("external_id", "=", "bookvolume")
      .execute();
    expect(authors).toEqual([{ author_name: "Fresh Author" }]);
  });

  it("skips legacy OpenLibrary ids that Google Books cannot resolve", async () => {
    await cacheBook("OL45804W");

    const response = await run();

    expect(await response.json()).toMatchObject({ processed: 0 });
    expect(requestsTo("googleapis.com/books")).toHaveLength(0);
  });

  it("keeps going and reports the failure when one work's fetch errors", async () => {
    await cacheMovieDetails("42");
    await cacheMovieDetails("43");
    server.use(
      http.get(
        "https://api.themoviedb.org/3/movie/42",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const response = await run();
    const body = await response.json();

    expect(body).toMatchObject({ success: true, processed: 2, updated: 1, skipped: 1 });
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatchObject({ type: "movie", externalId: "42" });
  });

  it("reports success with nothing to do when no metadata is cached", async () => {
    const response = await run();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ processed: 0, updated: 0, skipped: 0 });
  });

  it("returns 500 when the scheduled payload is not the expected shape", async () => {
    const response = await refreshHandler(scheduledRequest({ wrong: "shape" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  });
});
