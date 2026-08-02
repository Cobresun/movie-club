/**
 * Tests for lib/googleBooks.ts — the pure normalizers shared by the frontend
 * book search/browse code and the backend book provider (#396, the
 * OpenLibrary → Google Books migration).
 */
import { describe, expect, it } from "vitest";

import {
  bestCoverUrl,
  parsePublishedYear,
  secureImageUrl,
  sortVolumesByPopularity,
  splitCategories,
  stripHtml,
} from "../googleBooks";
import { GoogleBooksVolume } from "../types/book";

// ─── secureImageUrl ───────────────────────────────────────────────────────────

describe("secureImageUrl", () => {
  it("upgrades the http URLs the API returns to https", () => {
    expect(secureImageUrl("http://books.google.com/books/content?id=abc")).toBe(
      "https://books.google.com/books/content?id=abc",
    );
  });

  it("leaves an already-secure URL alone", () => {
    expect(secureImageUrl("https://books.google.com/x")).toBe("https://books.google.com/x");
  });

  it("strips the page-curl effect when it is the trailing param", () => {
    expect(secureImageUrl("https://books.google.com/x?id=abc&edge=curl")).toBe(
      "https://books.google.com/x?id=abc",
    );
  });

  it("strips the page-curl effect from the middle of the query string", () => {
    expect(secureImageUrl("https://books.google.com/x?edge=curl&zoom=1")).toBe(
      "https://books.google.com/x?zoom=1",
    );
  });
});

// ─── bestCoverUrl ─────────────────────────────────────────────────────────────

describe("bestCoverUrl", () => {
  it("returns undefined when the volume has no images", () => {
    expect(bestCoverUrl(undefined)).toBeUndefined();
    expect(bestCoverUrl({})).toBeUndefined();
  });

  it("prefers the medium image over every smaller size", () => {
    const url = bestCoverUrl({
      medium: "https://books.google.com/medium",
      small: "https://books.google.com/small",
      thumbnail: "https://books.google.com/thumb",
      smallThumbnail: "https://books.google.com/small-thumb",
    });

    expect(url).toBe("https://books.google.com/medium");
  });

  it("falls back through small, thumbnail, then smallThumbnail", () => {
    expect(bestCoverUrl({ small: "https://x/small", thumbnail: "https://x/thumb" })).toBe(
      "https://x/small",
    );
    expect(bestCoverUrl({ thumbnail: "https://x/thumb", smallThumbnail: "https://x/tiny" })).toBe(
      "https://x/thumb",
    );
    expect(bestCoverUrl({ smallThumbnail: "https://x/tiny" })).toBe("https://x/tiny");
  });

  it("secures and de-curls the chosen image", () => {
    expect(bestCoverUrl({ thumbnail: "http://books.google.com/x?id=1&edge=curl" })).toBe(
      "https://books.google.com/x?id=1",
    );
  });

  it("drops a URL too long for the varchar(255) column rather than failing the insert", () => {
    const long = `https://books.google.com/${"a".repeat(255)}`;

    expect(bestCoverUrl({ thumbnail: long })).toBeUndefined();
  });

  it("keeps a URL exactly at the column limit", () => {
    const exact = `https://books.google.com/${"a".repeat(255 - "https://books.google.com/".length)}`;
    expect(exact).toHaveLength(255);

    expect(bestCoverUrl({ thumbnail: exact })).toBe(exact);
  });
});

// ─── parsePublishedYear ───────────────────────────────────────────────────────

describe("parsePublishedYear", () => {
  it("returns undefined when the volume has no published date", () => {
    expect(parsePublishedYear(undefined)).toBeUndefined();
    expect(parsePublishedYear("")).toBeUndefined();
  });

  it("reads a year-only date", () => {
    expect(parsePublishedYear("1965")).toBe(1965);
  });

  it("reads the year out of a full date", () => {
    expect(parsePublishedYear("1965-08-01")).toBe(1965);
    expect(parsePublishedYear("2003-11")).toBe(2003);
  });

  it("returns undefined for a date that does not start with a year", () => {
    expect(parsePublishedYear("August 1965")).toBeUndefined();
  });
});

// ─── stripHtml ────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("leaves plain text untouched", () => {
    expect(stripHtml("A plain description.")).toBe("A plain description.");
  });

  it("removes inline markup, keeping the text", () => {
    expect(stripHtml("A <b>great</b> <i>book</i>.")).toBe("A great book.");
  });

  it("turns line breaks into newlines", () => {
    expect(stripHtml("One<br>Two<br />Three")).toBe("One\nTwo\nThree");
  });

  it("turns paragraph ends into blank lines", () => {
    expect(stripHtml("<p>First</p><p>Second</p>")).toBe("First\n\nSecond");
  });

  it("collapses runs of blank lines so paragraphs stay even", () => {
    expect(stripHtml("<p>First</p><br><br><p>Second</p>")).toBe("First\n\nSecond");
  });

  it("decodes the entities Google escapes", () => {
    expect(stripHtml("Tom &amp; Jerry &lt;the&gt; &quot;best&quot; &#39;duo&#39;")).toBe(
      "Tom & Jerry <the> \"best\" 'duo'",
    );
  });

  it("leaves an unrecognised entity as-is rather than mangling it", () => {
    expect(stripHtml("100&deg; out")).toBe("100&deg; out");
  });

  it("trims surrounding whitespace left behind by stripped tags", () => {
    expect(stripHtml("<p>  Padded  </p>")).toBe("Padded");
  });
});

// ─── sortVolumesByPopularity ──────────────────────────────────────────────────

function volume(id: string, ratingsCount?: number): GoogleBooksVolume {
  return { id, volumeInfo: { title: id, ratingsCount } };
}

describe("sortVolumesByPopularity", () => {
  it("puts the most-rated volume first", () => {
    const sorted = sortVolumesByPopularity([volume("a", 3), volume("b", 90), volume("c", 12)]);

    expect(sorted.map((v) => v.id)).toEqual(["b", "c", "a"]);
  });

  it("treats a volume with no ratings as zero", () => {
    const sorted = sortVolumesByPopularity([volume("unrated"), volume("rated", 1)]);

    expect(sorted.map((v) => v.id)).toEqual(["rated", "unrated"]);
  });

  it("keeps Google's relevance order among equally rated volumes", () => {
    const sorted = sortVolumesByPopularity([volume("first"), volume("second"), volume("third")]);

    expect(sorted.map((v) => v.id)).toEqual(["first", "second", "third"]);
  });

  it("does not mutate the caller's array", () => {
    const volumes = [volume("a", 1), volume("b", 9)];

    sortVolumesByPopularity(volumes);

    expect(volumes.map((v) => v.id)).toEqual(["a", "b"]);
  });
});

// ─── splitCategories ──────────────────────────────────────────────────────────

describe("splitCategories", () => {
  it("returns nothing for a volume with no categories", () => {
    expect(splitCategories([])).toEqual([]);
  });

  it("flattens a BISAC path into its individual terms", () => {
    expect(splitCategories(["Fiction / Thrillers / Suspense"])).toEqual([
      "Fiction",
      "Thrillers",
      "Suspense",
    ]);
  });

  it("dedupes terms repeated across paths", () => {
    expect(splitCategories(["Fiction / Thrillers", "Fiction / Science Fiction"])).toEqual([
      "Fiction",
      "Thrillers",
      "Science Fiction",
    ]);
  });

  it("trims stray whitespace around terms", () => {
    expect(splitCategories(["  Fiction  /  Horror  "])).toEqual(["Fiction", "Horror"]);
  });

  it("drops the empty segment left by a trailing separator", () => {
    expect(splitCategories(["Fiction / Horror / "])).toEqual(["Fiction", "Horror"]);
  });
});
