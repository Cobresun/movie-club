/**
 * Tests for netlify/functions/utils/providers/googleBooks.ts
 *
 * Real axios against MSW-faked HTTP, so the assertions read the URL actually
 * requested. The key is supplied via vi.stubEnv — never vi.unstubAllEnvs(),
 * which would restore the ambient environment (unset locally, populated on CI)
 * and make the keyless case flaky.
 */
import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureGet } from "../../../tests/msw";
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
    captureGet(VOLUME_URL, () => ({ id: "zyTCAlFPjgYC", volumeInfo: { title: "Dune" } }));

    const volume = await getGoogleBooksVolume("zyTCAlFPjgYC");

    expect(volume.volumeInfo?.title).toBe("Dune");
  });

  it("requests the volume by id against the v1 books API", async () => {
    const calls = captureGet(VOLUME_URL, () => ({ id: "abc" }));

    await getGoogleBooksVolume("abc");

    expect(calls[0]?.url.pathname).toBe("/books/v1/volumes/abc");
  });

  it("sends the API key when one is configured", async () => {
    const calls = captureGet(VOLUME_URL, () => ({ id: "abc" }));

    await getGoogleBooksVolume("abc");

    expect(calls[0]?.url.searchParams.get("key")).toBe("test-books-key");
  });

  it("omits the key entirely when unset — an empty key param is a 400", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    const calls = captureGet(VOLUME_URL, () => ({ id: "abc" }));

    await getGoogleBooksVolume("abc");

    expect(calls[0]?.url.searchParams.has("key")).toBe(false);
  });

  it("propagates API errors to the caller", async () => {
    captureGet(VOLUME_URL, () => HttpResponse.json({ error: "rate limited" }, { status: 429 }));

    await expect(getGoogleBooksVolume("abc")).rejects.toThrow(
      "Request failed with status code 429",
    );
  });
});

describe("searchGoogleBooksVolumes", () => {
  it("returns the matched volumes", async () => {
    captureGet(SEARCH_URL, () => ({ totalItems: 2, items: [{ id: "a" }, { id: "b" }] }));

    const volumes = await searchGoogleBooksVolumes("dune");

    expect(volumes.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when the response omits items on no results", async () => {
    // The API leaves `items` absent rather than sending [].
    captureGet(SEARCH_URL, () => ({ totalItems: 0 }));

    await expect(searchGoogleBooksVolumes("no such book")).resolves.toEqual([]);
  });

  it("searches books only, by relevance, 20 at a time by default", async () => {
    const calls = captureGet(SEARCH_URL, () => ({ totalItems: 0 }));

    await searchGoogleBooksVolumes("dune");

    const params = calls[0]?.url.searchParams;
    expect(params?.get("q")).toBe("dune");
    expect(params?.get("printType")).toBe("books");
    expect(params?.get("orderBy")).toBe("relevance");
    expect(params?.get("maxResults")).toBe("20");
  });

  it("honours a caller's ordering and page size", async () => {
    const calls = captureGet(SEARCH_URL, () => ({ totalItems: 0 }));

    await searchGoogleBooksVolumes("dune", { orderBy: "newest", maxResults: 5 });

    const params = calls[0]?.url.searchParams;
    expect(params?.get("orderBy")).toBe("newest");
    expect(params?.get("maxResults")).toBe("5");
  });

  it("encodes a query containing spaces and punctuation", async () => {
    const calls = captureGet(SEARCH_URL, () => ({ totalItems: 0 }));

    await searchGoogleBooksVolumes('intitle:"The Left Hand of Darkness"');

    expect(calls[0]?.url.searchParams.get("q")).toBe('intitle:"The Left Hand of Darkness"');
  });
});
