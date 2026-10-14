import { describe, expect, it } from "vitest";

import { DetailedBookData } from "../../lib/types/book";
import { ClubType, WorkType } from "../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../lib/types/lists";
import { DetailedMovieData } from "../../lib/types/movie";
import type { FilterSelection } from "./components/filterTypes";
import { filterWorks } from "./filterWorks";

function bookItem(
  id: string,
  data: Partial<DetailedBookData>,
): DetailedWorkListItem<DetailedBookData> {
  return {
    id,
    type: WorkType.book,
    title: data.title ?? id,
    createdDate: "2026-01-01",
    externalData: {
      kind: "book",
      title: data.title ?? id,
      authors: data.authors ?? [],
      subjects: data.subjects ?? [],
      firstPublishYear: data.firstPublishYear,
      numberOfPages: data.numberOfPages,
    },
  };
}

function movieItem(
  id: string,
  data: Partial<DetailedMovieData>,
): DetailedWorkListItem<DetailedMovieData> {
  return {
    id,
    type: WorkType.movie,
    title: data.title ?? id,
    createdDate: "2026-01-01",
    externalData: {
      kind: "movie",
      actors: data.actors ?? [],
      // The actor filter reads castNames (the bulk-payload field); derive it
      // from the test's actor fixtures so filter tests exercise the real path.
      castNames: data.castNames ?? (data.actors ?? []).map((a) => a.name),
      majorCastNames: data.castNames ?? (data.actors ?? []).map((a) => a.name),
      directors: [],
      genres: data.genres ?? [],
      production_companies: data.production_companies ?? [],
      production_countries: [],
      runtime: data.runtime,
    },
  };
}

const items = [
  bookItem("a", { firstPublishYear: 1949, numberOfPages: 328 }),
  bookItem("b", { firstPublishYear: 2005, numberOfPages: 700 }),
  bookItem("c", { firstPublishYear: 2020, numberOfPages: 150 }),
];

const ids = (rows: DetailedWorkListItem[]) => rows.map((r) => r.id);

function filtered(
  rows: DetailedWorkListItem[],
  selections: Record<string, FilterSelection>,
  clubType: ClubType,
  freeText = "",
) {
  return ids(filterWorks(rows, { selections, freeText }, clubType));
}

const choice = (...values: string[]): FilterSelection => ({ kind: "choice", values });
const range = (from?: number, to?: number): FilterSelection => ({ kind: "range", from, to });

describe("filterWorks range filters", () => {
  it("keeps works inside the span, both ends included", () => {
    expect(filtered(items, { first_publish_year: range(1949, 2005) }, ClubType.book)).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats a missing end as open", () => {
    expect(filtered(items, { pages: range(300) }, ClubType.book)).toEqual(["a", "b"]);
    expect(filtered(items, { pages: range(undefined, 200) }, ClubType.book)).toEqual(["c"]);
  });

  it("excludes works missing the value", () => {
    const withMissing = [
      ...items,
      bookItem("d", { firstPublishYear: undefined, numberOfPages: undefined }),
    ];
    expect(filtered(withMissing, { pages: range(0) }, ClubType.book)).toEqual(["a", "b", "c"]);
  });
});

describe("filterWorks choice and free-text filters", () => {
  const books = [
    bookItem("orwell", { authors: ["George Orwell"], subjects: ["Dystopia"] }),
    bookItem("huxley", { authors: ["Aldous Huxley"], subjects: ["Dystopia"] }),
    bookItem("tolkien", { authors: ["J.R.R. Tolkien"], subjects: ["Fantasy"] }),
  ];

  it("filters books by author", () => {
    expect(filtered(books, { author: choice("George Orwell") }, ClubType.book)).toEqual(["orwell"]);
  });

  it("keeps a work matching any of the values picked in one filter", () => {
    expect(
      filtered(books, { author: choice("George Orwell", "J.R.R. Tolkien") }, ClubType.book),
    ).toEqual(["orwell", "tolkien"]);
  });

  it("filters books by subject", () => {
    expect(filtered(books, { subject: choice("Dystopia") }, ClubType.book)).toEqual([
      "orwell",
      "huxley",
    ]);
  });

  it("ANDs separate filters together", () => {
    const movies = [
      movieItem("short", { genres: ["Drama"], runtime: 90 }),
      movieItem("epic", { genres: ["Drama", "War"], runtime: 200 }),
      movieItem("comedy", { genres: ["Comedy"], runtime: 100 }),
    ];
    expect(
      filtered(movies, { genre: choice("Drama"), runtime: range(120) }, ClubType.movie),
    ).toEqual(["epic"]);
  });

  it("matches free text against the title", () => {
    expect(filtered(books, {}, ClubType.book, "tolkien")).toEqual(["tolkien"]);
  });
});

describe("filterWorks movie cast filter", () => {
  const movies = [
    movieItem("forrest", {
      title: "Forrest Gump",
      genres: ["Drama"],
      actors: [
        { name: "Tom Hanks", character: "Forrest Gump", profilePath: null },
        { name: "Robin Wright", character: "Jenny Curran", profilePath: "/rw.jpg" },
      ],
    }),
    movieItem("matrix", {
      title: "The Matrix",
      genres: ["Action"],
      actors: [
        { name: "Keanu Reeves", character: "Neo", profilePath: "/kr.jpg" },
        { name: "Laurence Fishburne", character: "Morpheus", profilePath: null },
      ],
    }),
    movieItem("silent", { title: "Silent Film", actors: [] }),
  ];

  it("keeps movies the actor appears in", () => {
    expect(filtered(movies, { actor: choice("Tom Hanks") }, ClubType.movie)).toEqual(["forrest"]);
  });

  it("excludes movies with no matching actor", () => {
    expect(filtered(movies, { actor: choice("Meryl Streep") }, ClubType.movie)).toEqual([]);
  });

  it("ANDs the cast filter with other filters", () => {
    expect(
      filtered(movies, { actor: choice("Tom Hanks"), genre: choice("Drama") }, ClubType.movie),
    ).toEqual(["forrest"]);
    expect(
      filtered(movies, { actor: choice("Tom Hanks"), genre: choice("Action") }, ClubType.movie),
    ).toEqual([]);
  });
});

describe("filterWorks club-type scoping", () => {
  it("ignores filter keys the club type does not offer", () => {
    // `genre` is a movie-only filter; applying it to a book club is a no-op
    // because book clubs do not register a `genre` option.
    expect(filtered(items, { genre: choice("Drama") }, ClubType.book)).toEqual(["a", "b", "c"]);
  });
});
