/**
 * Tests for netlify/functions/utils/providers/googleBooks.ts
 *
 * axios is mocked so no real HTTP calls are made. The key is supplied via
 * vi.stubEnv — never vi.unstubAllEnvs(), which would restore the ambient
 * environment (unset locally, populated on CI) and make the keyless case flaky.
 */
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGoogleBooksVolume, searchGoogleBooksVolumes } from "../googleBooks";

vi.mock("axios");

const axiosGetMock = vi.mocked(axios.get);

/** The query string of the URL axios was last called with. */
function calledParams() {
  const url = axiosGetMock.mock.calls[0]?.[0] ?? "";
  return new URL(url).searchParams;
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_BOOKS_API_KEY", "test-books-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("getGoogleBooksVolume", () => {
  it("returns the volume payload for the requested id", async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: { id: "zyTCAlFPjgYC", volumeInfo: { title: "Dune" } },
      status: 200,
    });

    const volume = await getGoogleBooksVolume("zyTCAlFPjgYC");

    expect(volume.volumeInfo?.title).toBe("Dune");
  });

  it("requests the volume by id against the v1 books API", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { id: "abc" }, status: 200 });

    await getGoogleBooksVolume("abc");

    const url = axiosGetMock.mock.calls[0]?.[0] ?? "";
    expect(url).toContain("https://www.googleapis.com/books/v1/volumes/abc");
  });

  it("sends the API key when one is configured", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { id: "abc" }, status: 200 });

    await getGoogleBooksVolume("abc");

    expect(calledParams().get("key")).toBe("test-books-key");
  });

  it("omits the key entirely when unset — an empty key param is a 400", async () => {
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
    axiosGetMock.mockResolvedValueOnce({ data: { id: "abc" }, status: 200 });

    await getGoogleBooksVolume("abc");

    expect(calledParams().has("key")).toBe(false);
  });

  it("propagates API errors to the caller", async () => {
    axiosGetMock.mockRejectedValueOnce(new Error("429 Too Many Requests"));

    await expect(getGoogleBooksVolume("abc")).rejects.toThrow("429 Too Many Requests");
  });
});

describe("searchGoogleBooksVolumes", () => {
  it("returns the matched volumes", async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: { totalItems: 2, items: [{ id: "a" }, { id: "b" }] },
      status: 200,
    });

    const volumes = await searchGoogleBooksVolumes("dune");

    expect(volumes.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when the response omits items on no results", async () => {
    // The API leaves `items` absent rather than sending [].
    axiosGetMock.mockResolvedValueOnce({ data: { totalItems: 0 }, status: 200 });

    await expect(searchGoogleBooksVolumes("no such book")).resolves.toEqual([]);
  });

  it("searches books only, by relevance, 20 at a time by default", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { totalItems: 0 }, status: 200 });

    await searchGoogleBooksVolumes("dune");

    const params = calledParams();
    expect(params.get("q")).toBe("dune");
    expect(params.get("printType")).toBe("books");
    expect(params.get("orderBy")).toBe("relevance");
    expect(params.get("maxResults")).toBe("20");
  });

  it("honours a caller's ordering and page size", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { totalItems: 0 }, status: 200 });

    await searchGoogleBooksVolumes("dune", { orderBy: "newest", maxResults: 5 });

    const params = calledParams();
    expect(params.get("orderBy")).toBe("newest");
    expect(params.get("maxResults")).toBe("5");
  });

  it("encodes a query containing spaces and punctuation", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: { totalItems: 0 }, status: 200 });

    await searchGoogleBooksVolumes('intitle:"The Left Hand of Darkness"');

    expect(calledParams().get("q")).toBe('intitle:"The Left Hand of Darkness"');
  });
});
