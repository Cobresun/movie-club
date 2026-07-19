import { WorkType } from "../../../../lib/types/generated/db";
import { extractImdbId, parseAddLinkQuery } from "../addLink";

describe("extractImdbId", () => {
  it("finds an imdb id inside a url", () => {
    expect(extractImdbId("https://www.imdb.com/title/tt1375666/")).toBe(
      "tt1375666",
    );
  });

  it("returns undefined when there is none", () => {
    expect(extractImdbId("https://example.com/movie")).toBeUndefined();
    expect(extractImdbId(undefined)).toBeUndefined();
  });
});

describe("parseAddLinkQuery", () => {
  it("parses the explicit params the extension sends", () => {
    expect(
      parseAddLinkQuery({
        imdb: "tt1375666",
        title: "Inception",
        year: "2010",
      }),
    ).toEqual({
      workType: WorkType.movie,
      imdbId: "tt1375666",
      title: "Inception",
      year: "2010",
    });
  });

  it("extracts an imdb id from a shared url param", () => {
    const target = parseAddLinkQuery({
      url: "https://www.imdb.com/title/tt1375666/",
    });
    expect(target.imdbId).toBe("tt1375666");
  });

  it("extracts an imdb id and title from a messy shared text blob", () => {
    const target = parseAddLinkQuery({
      text: "Check this out: Inception (2010) https://www.imdb.com/title/tt1375666/",
    });
    expect(target.imdbId).toBe("tt1375666");
    expect(target.title).toBe("Check this out: Inception");
    expect(target.year).toBe("2010");
  });

  it("cleans share-page noise from titles", () => {
    const target = parseAddLinkQuery({ title: "Inception (2010) - IMDb" });
    expect(target.title).toBe("Inception");
    expect(target.year).toBe("2010");
  });

  it("uses the first value of array params", () => {
    const target = parseAddLinkQuery({
      imdb: ["tt1375666", "tt0111161"],
      title: ["Inception", "The Shawshank Redemption"],
    });
    expect(target.imdbId).toBe("tt1375666");
    expect(target.title).toBe("Inception");
  });

  it("does not read a year out of url digits", () => {
    const target = parseAddLinkQuery({
      url: "https://example.com/2010/some-movie",
      text: "Some movie https://example.com/reviews/1999/best",
    });
    expect(target.year).toBeUndefined();
  });

  it("returns an all-undefined target for an empty query", () => {
    expect(parseAddLinkQuery({})).toEqual({
      workType: WorkType.movie,
      imdbId: undefined,
      title: undefined,
      year: undefined,
    });
  });
});
