import { describe, expect, it } from "vitest";

import { filterWorks } from "./filterWorks";
import { DetailedBookData } from "../../lib/types/book";
import { ClubType, WorkType } from "../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../lib/types/lists";
import { DetailedMovieData } from "../../lib/types/movie";

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

describe("filterWorks book numeric filters", () => {
  it("filters by first_publish_year with comparators", () => {
    expect(
      ids(
        filterWorks(
          items,
          {
            filters: { first_publish_year: { operator: "<", value: "2000" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["a"]);

    expect(
      ids(
        filterWorks(
          items,
          {
            filters: { first_publish_year: { operator: ">", value: "2000" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["b", "c"]);

    expect(
      ids(
        filterWorks(
          items,
          {
            filters: { first_publish_year: { operator: "=", value: "2020" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["c"]);
  });

  it("filters by pages with comparators", () => {
    expect(
      ids(
        filterWorks(
          items,
          {
            filters: { pages: { operator: ">", value: "300" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["a", "b"]);

    expect(
      ids(
        filterWorks(
          items,
          {
            filters: { pages: { operator: "<", value: "200" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["c"]);
  });

  it("excludes books missing the numeric field", () => {
    const withMissing = [
      ...items,
      bookItem("d", { firstPublishYear: undefined, numberOfPages: undefined }),
    ];
    expect(
      ids(
        filterWorks(
          withMissing,
          {
            filters: { pages: { operator: ">", value: "0" } },
            freeText: "",
          },
          ClubType.book,
        ),
      ),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("filterWorks enum and free-text filters", () => {
  const books = [
    bookItem("orwell", { authors: ["George Orwell"], subjects: ["Dystopia"] }),
    bookItem("huxley", { authors: ["Aldous Huxley"], subjects: ["Dystopia"] }),
    bookItem("tolkien", { authors: ["J.R.R. Tolkien"], subjects: ["Fantasy"] }),
  ];

  it("filters books by author (case-insensitive, partial)", () => {
    expect(
      ids(
        filterWorks(
          books,
          { filters: { author: { value: "orwell" } }, freeText: "" },
          ClubType.book,
        ),
      ),
    ).toEqual(["orwell"]);
  });

  it("filters books by subject", () => {
    expect(
      ids(
        filterWorks(
          books,
          { filters: { subject: { value: "Dystopia" } }, freeText: "" },
          ClubType.book,
        ),
      ),
    ).toEqual(["orwell", "huxley"]);
  });

  it("filters movies by genre and runtime through the same function", () => {
    const movies = [
      movieItem("short", { genres: ["Drama"], runtime: 90 }),
      movieItem("epic", { genres: ["Drama", "War"], runtime: 200 }),
      movieItem("comedy", { genres: ["Comedy"], runtime: 100 }),
    ];
    expect(
      ids(
        filterWorks(
          movies,
          {
            filters: {
              genre: { value: "Drama" },
              runtime: { operator: ">", value: "120" },
            },
            freeText: "",
          },
          ClubType.movie,
        ),
      ),
    ).toEqual(["epic"]);
  });

  it("matches free text against the title", () => {
    expect(
      ids(
        filterWorks(books, { filters: {}, freeText: "tolkien" }, ClubType.book),
      ),
    ).toEqual(["tolkien"]);
  });
});

describe("filterWorks movie actor filter", () => {
  const movies = [
    movieItem("forrest", {
      title: "Forrest Gump",
      genres: ["Drama"],
      actors: [
        { name: "Tom Hanks", character: "Forrest Gump", profilePath: null },
        {
          name: "Robin Wright",
          character: "Jenny Curran",
          profilePath: "/rw.jpg",
        },
      ],
    }),
    movieItem("matrix", {
      title: "The Matrix",
      genres: ["Action"],
      actors: [
        { name: "Keanu Reeves", character: "Neo", profilePath: "/kr.jpg" },
        {
          name: "Laurence Fishburne",
          character: "Morpheus",
          profilePath: null,
        },
      ],
    }),
    movieItem("silent", { title: "Silent Film", actors: [] }),
  ];

  it("matches movies where an actor name contains the value", () => {
    expect(
      ids(
        filterWorks(
          movies,
          { filters: { actor: { value: "Tom Hanks" } }, freeText: "" },
          ClubType.movie,
        ),
      ),
    ).toEqual(["forrest"]);
  });

  it("is case-insensitive and matches partial names", () => {
    expect(
      ids(
        filterWorks(
          movies,
          { filters: { actor: { value: "hanks" } }, freeText: "" },
          ClubType.movie,
        ),
      ),
    ).toEqual(["forrest"]);
  });

  it("excludes movies with no matching actor", () => {
    expect(
      ids(
        filterWorks(
          movies,
          { filters: { actor: { value: "Meryl Streep" } }, freeText: "" },
          ClubType.movie,
        ),
      ),
    ).toEqual([]);
  });

  it("ANDs the actor filter with other filters", () => {
    expect(
      ids(
        filterWorks(
          movies,
          {
            filters: {
              actor: { value: "hanks" },
              genre: { value: "Drama" },
            },
            freeText: "",
          },
          ClubType.movie,
        ),
      ),
    ).toEqual(["forrest"]);

    expect(
      ids(
        filterWorks(
          movies,
          {
            filters: {
              actor: { value: "Tom Hanks" },
              genre: { value: "Action" },
            },
            freeText: "",
          },
          ClubType.movie,
        ),
      ),
    ).toEqual([]);
  });
});

describe("filterWorks club-type scoping", () => {
  it("ignores filter keys the club type does not offer", () => {
    // `genre` is a movie-only filter; applying it to a book club is a no-op
    // because book clubs do not register a `genre` option.
    expect(
      ids(
        filterWorks(
          items,
          { filters: { genre: { value: "Drama" } }, freeText: "" },
          ClubType.book,
        ),
      ),
    ).toEqual(["a", "b", "c"]);
  });
});
