/**
 * Tests for netlify/functions/utils/providers/googleBooks.ts
 *
 * Real axios against MSW-faked HTTP: `netlify/functions/tests/mocks/handlers.ts`
 * answers the volume and search endpoints with the default fixtures, and a test
 * overrides them with `server.use` when it needs a different body. Both fixtures
 * are derived from the id (or query) that was requested, so asserting on the
 * returned volumes is also what proves the right request went out.
 *
 * The key is supplied via vi.stubEnv — never vi.unstubAllEnvs() mid-test, which
 * would restore the ambient environment (unset locally, populated on CI) and
 * make the keyless case flaky.
 */
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { googleBooksVolume } from "../../../tests/fixtures/external";
import { server } from "../../../tests/mocks/server";
import { getGoogleBooksVolume, searchGoogleBooksVolumes } from "../googleBooks";

const VOLUME_URL = "https://www.googleapis.com/books/v1/volumes/:volumeId";
const SEARCH_URL = "https://www.googleapis.com/books/v1/volumes";

beforeEach(() => {
  vi.stubEnv("GOOGLE_BOOKS_API_KEY", "test-books-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getGoogleBooksVolume", () => {
  it("returns the volume payload for the requested id", async () => {
    const volume = await getGoogleBooksVolume("zyTCAlFPjgYC");

    expect(volume).toEqual(googleBooksVolume("zyTCAlFPjgYC"));
  });

  it("still fetches the volume when no API key is configured", async () => {
    // Keyless requests are allowed at a low rate limit, but `key=` with an
    // empty value is a 400 — which the default handler reproduces, so this
    // rejects if the provider stops omitting the param.
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");

    await expect(getGoogleBooksVolume("abc")).resolves.toEqual(googleBooksVolume("abc"));
  });

  it("propagates API errors to the caller", async () => {
    server.use(
      http.get(VOLUME_URL, () => HttpResponse.json({ error: "rate limited" }, { status: 429 })),
    );

    await expect(getGoogleBooksVolume("abc")).rejects.toThrow(
      "Request failed with status code 429",
    );
  });
});

describe("searchGoogleBooksVolumes", () => {
  it("returns the matched volumes", async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          totalItems: 2,
          items: [googleBooksVolume("a"), googleBooksVolume("b")],
        }),
      ),
    );

    const volumes = await searchGoogleBooksVolumes("dune");

    expect(volumes.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("searches for the caller's query", async () => {
    // The default handler echoes `q` back in the volume it returns.
    const volumes = await searchGoogleBooksVolumes('intitle:"The Left Hand of Darkness"');

    expect(volumes.map((v) => v.id)).toEqual(['vol-intitle:"The Left Hand of Darkness"']);
  });

  it("returns an empty array when the response omits items on no results", async () => {
    // The API leaves `items` absent rather than sending [].
    server.use(http.get(SEARCH_URL, () => HttpResponse.json({ totalItems: 0 })));

    await expect(searchGoogleBooksVolumes("no such book")).resolves.toEqual([]);
  });

  it("still searches when no API key is configured", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");

    await expect(searchGoogleBooksVolumes("dune")).resolves.toHaveLength(1);
  });
});
