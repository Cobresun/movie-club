import { describe, expect, it } from "vitest";

import { authorsMatch, normalizeTitle, selectBestVolume, titlesMatch } from "@/../lib/bookMatching";
import { GoogleBooksVolume } from "@/../lib/types/book";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation and articles", () => {
    expect(normalizeTitle("The Great Gatsby!")).toBe("great gatsby");
  });

  it("strips diacritics", () => {
    expect(normalizeTitle("Les Misérables")).toBe("les miserables");
  });
});

describe("titlesMatch", () => {
  it("matches identical titles ignoring case and articles", () => {
    expect(titlesMatch("The Hobbit", "hobbit")).toBe(true);
  });

  it("matches when one title is a subtitle-extended prefix", () => {
    expect(titlesMatch("Sapiens", "Sapiens: A Brief History of Humankind")).toBe(true);
  });

  it("rejects unrelated titles", () => {
    expect(titlesMatch("Dune", "Emma")).toBe(false);
  });

  it("rejects empty titles", () => {
    expect(titlesMatch("", "Dune")).toBe(false);
  });
});

describe("authorsMatch", () => {
  it("matches on shared surname", () => {
    expect(authorsMatch(["F. Scott Fitzgerald"], "Fitzgerald")).toBe(true);
  });

  it("rejects different surnames", () => {
    expect(authorsMatch(["Harper Lee"], "Fitzgerald")).toBe(false);
  });
});

function volume(id: string, info: NonNullable<GoogleBooksVolume["volumeInfo"]>): GoogleBooksVolume {
  return { id, volumeInfo: info };
}

describe("selectBestVolume", () => {
  const target = { title: "The Great Gatsby", author: "F. Scott Fitzgerald" };

  it("rejects candidates with wrong titles or authors", () => {
    const candidates = [
      volume("wrong-title", {
        title: "Gatsby's Girl",
        authors: ["F. Scott Fitzgerald"],
      }),
      volume("wrong-author", {
        title: "The Great Gatsby",
        authors: ["Someone Else"],
      }),
    ];
    expect(selectBestVolume(candidates, target.title, target.author)).toBeUndefined();
  });

  it("prefers exact titles with covers over subtitle variants", () => {
    const candidates = [
      volume("variant", {
        title: "The Great Gatsby",
        subtitle: "Annotated Edition",
        authors: ["F. Scott Fitzgerald"],
      }),
      volume("exact", {
        title: "The Great Gatsby",
        authors: ["F. Scott Fitzgerald"],
        imageLinks: { thumbnail: "http://x.com/t" },
        pageCount: 180,
      }),
    ];
    expect(selectBestVolume(candidates, target.title, target.author)?.id).toBe("exact");
  });

  it("accepts a title-only match when the author is unknown", () => {
    const candidates = [volume("match", { title: "The Great Gatsby", authors: ["Anyone"] })];
    expect(selectBestVolume(candidates, target.title, undefined)?.id).toBe("match");
  });

  it("returns undefined for empty candidates", () => {
    expect(selectBestVolume([], target.title, target.author)).toBeUndefined();
  });
});
