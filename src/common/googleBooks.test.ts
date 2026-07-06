import { describe, expect, it } from "vitest";

import {
  bestCoverUrl,
  parsePublishedYear,
  secureImageUrl,
  sortVolumesByPopularity,
  splitCategories,
  stripHtml,
} from "@/../lib/googleBooks";
import { GoogleBooksVolume } from "@/../lib/types/book";

describe("secureImageUrl", () => {
  it("rewrites http to https", () => {
    expect(secureImageUrl("http://books.google.com/img?id=1")).toBe(
      "https://books.google.com/img?id=1",
    );
  });

  it("strips the edge=curl param mid-query", () => {
    expect(secureImageUrl("https://x.com/img?id=1&edge=curl&zoom=1")).toBe(
      "https://x.com/img?id=1&zoom=1",
    );
  });

  it("strips the edge=curl param at the end of the query", () => {
    expect(secureImageUrl("https://x.com/img?id=1&edge=curl")).toBe(
      "https://x.com/img?id=1",
    );
  });

  it("leaves clean urls untouched", () => {
    expect(secureImageUrl("https://x.com/img?id=1")).toBe(
      "https://x.com/img?id=1",
    );
  });
});

describe("bestCoverUrl", () => {
  it("prefers larger sizes", () => {
    expect(
      bestCoverUrl({
        thumbnail: "http://x.com/thumb",
        medium: "http://x.com/medium",
      }),
    ).toBe("https://x.com/medium");
  });

  it("falls back through sizes", () => {
    expect(bestCoverUrl({ smallThumbnail: "http://x.com/small" })).toBe(
      "https://x.com/small",
    );
  });

  it("returns undefined without imageLinks", () => {
    expect(bestCoverUrl(undefined)).toBeUndefined();
    expect(bestCoverUrl({})).toBeUndefined();
  });

  it("drops urls longer than the cover_url column", () => {
    const longUrl = `http://x.com/${"a".repeat(300)}`;
    expect(bestCoverUrl({ thumbnail: longUrl })).toBeUndefined();
  });
});

describe("parsePublishedYear", () => {
  it("parses full dates", () => {
    expect(parsePublishedYear("1925-04-10")).toBe(1925);
  });

  it("parses bare years", () => {
    expect(parsePublishedYear("1960")).toBe(1960);
  });

  it("returns undefined for missing or malformed dates", () => {
    expect(parsePublishedYear(undefined)).toBeUndefined();
    expect(parsePublishedYear("")).toBeUndefined();
    expect(parsePublishedYear("19th century")).toBeUndefined();
  });
});

describe("stripHtml", () => {
  it("strips tags and keeps text", () => {
    expect(stripHtml("<p>A <b>classic</b> novel.</p>")).toBe(
      "A classic novel.",
    );
  });

  it("turns breaks and paragraphs into newlines", () => {
    expect(stripHtml("<p>One</p><p>Two<br/>Three</p>")).toBe(
      "One\n\nTwo\nThree",
    );
  });

  it("decodes common entities", () => {
    expect(stripHtml("Cats &amp; dogs &quot;fight&quot; &#39;often&#39;")).toBe(
      `Cats & dogs "fight" 'often'`,
    );
  });

  it("passes plain text through", () => {
    expect(stripHtml("No markup here.")).toBe("No markup here.");
  });
});

describe("sortVolumesByPopularity", () => {
  const volume = (id: string, ratingsCount?: number): GoogleBooksVolume => ({
    id,
    volumeInfo: { title: id, ratingsCount },
  });

  it("orders by ratingsCount descending", () => {
    const sorted = sortVolumesByPopularity([
      volume("a", 5),
      volume("b", 200),
      volume("c", 40),
    ]);
    expect(sorted.map((v) => v.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps relevance order among unrated volumes and ranks them last", () => {
    const sorted = sortVolumesByPopularity([
      volume("a"),
      volume("b", 3),
      { id: "c" },
      volume("d"),
    ]);
    expect(sorted.map((v) => v.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("does not mutate the input array", () => {
    const input = [volume("a", 1), volume("b", 2)];
    sortVolumesByPopularity(input);
    expect(input.map((v) => v.id)).toEqual(["a", "b"]);
  });
});

describe("splitCategories", () => {
  it("splits BISAC paths into deduped terms", () => {
    expect(
      splitCategories(["Fiction / Thrillers / Suspense", "Fiction / Legal"]),
    ).toEqual(["Fiction", "Thrillers", "Suspense", "Legal"]);
  });

  it("returns empty for no categories", () => {
    expect(splitCategories([])).toEqual([]);
  });
});
