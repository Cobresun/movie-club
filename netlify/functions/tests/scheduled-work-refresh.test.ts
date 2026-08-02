/**
 * Integration tests for `netlify/functions/scheduled-work-refresh.ts` — the
 * daily sweep that re-fetches the oldest cached metadata for every media
 * provider.
 *
 * The job exists to rewrite cached rows, so it is only meaningful against a
 * real database. What it wrote is read back off the list endpoint, which is
 * where the refreshed metadata actually reaches a client.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { ClubType, WorkType } from "../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../lib/types/lists";
import { MovieDataSummary } from "../../../lib/types/movie";
import { handler as clubHandler } from "../club/index";
import refreshHandler from "../scheduled-work-refresh";
import { googleBooksVolume, tmdbMovie } from "./fixtures/external";
import { signIn } from "./helpers/auth";
import { addWork, createClub, SeededClub } from "./helpers/factories";
import { requester } from "./helpers/http";
import { failOnRequest, GOOGLE_BOOKS, server } from "./setup/externalApis";

const api = requester(clubHandler);

function scheduledRequest(body: unknown) {
  return new Request("https://localhost/.netlify/functions/scheduled-work-refresh", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function run() {
  return refreshHandler(scheduledRequest({ next_run: "2026-01-01T00:00:00Z" }));
}

const metadataOf = async (club: SeededClub) => {
  const items = await api.get<DetailedWorkListItem[]>(`/api/club/${club.slug}/list/${club.listId}`);
  return items.body.map((item) => item.externalData);
};

describe("scheduled work refresh", () => {
  it("rewrites cached movie details from TMDB", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { title: "Stale", externalId: "42" });
    expect(await metadataOf(club)).toMatchObject([
      { tagline: "Tagline 42", overview: "Overview for movie 42" },
    ]);

    server.use(
      http.get("https://api.themoviedb.org/3/movie/42", () =>
        HttpResponse.json(
          tmdbMovie(42, { tagline: "Fresh tagline", overview: "A freshly fetched overview" }),
        ),
      ),
    );

    const response = await run();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, processed: 1, updated: 1 });
    expect(await metadataOf(club)).toMatchObject([
      { tagline: "Fresh tagline", overview: "A freshly fetched overview" },
    ]);
  });

  it("replaces the cast rather than appending to it", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { externalId: "42" });

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

    const [metadata] = await metadataOf(club);
    expect((metadata as MovieDataSummary).castNames).toEqual(["Only Actor"]);
  });

  it("refreshes book details and their authors", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.book });
    await addWork(club, alice, { type: WorkType.book, externalId: "bookvolume" });

    server.use(
      http.get("https://www.googleapis.com/books/v1/volumes/bookvolume", () =>
        HttpResponse.json(
          googleBooksVolume("bookvolume", { title: "Fresh Book", authors: ["Fresh Author"] }),
        ),
      ),
    );

    const response = await run();

    expect(await response.json()).toMatchObject({ success: true, processed: 1, updated: 1 });
    expect(await metadataOf(club)).toMatchObject([
      { kind: "book", title: "Fresh Book", authors: ["Fresh Author"] },
    ]);
  });

  it("skips legacy OpenLibrary ids that Google Books cannot resolve", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice, { type: ClubType.book });
    server.use(
      http.get("https://www.googleapis.com/books/v1/volumes/OL45804W", () =>
        HttpResponse.json(googleBooksVolume("OL45804W")),
      ),
    );
    await addWork(club, alice, { type: WorkType.book, externalId: "OL45804W" });

    // The id is unresolvable, so the sweep must leave it alone rather than
    // spend a Google Books call on it.
    failOnRequest("get", `${GOOGLE_BOOKS}/volumes/:volumeId`);
    failOnRequest("get", `${GOOGLE_BOOKS}/volumes`);

    const response = await run();

    expect(await response.json()).toMatchObject({ processed: 0 });
  });

  it("keeps going and reports the failure when one work's fetch errors", async () => {
    const alice = await signIn("alice");
    const club = await createClub(alice);
    await addWork(club, alice, { externalId: "42" });
    await addWork(club, alice, { externalId: "43" });

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
