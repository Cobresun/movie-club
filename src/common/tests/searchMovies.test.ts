import { WorkType } from "../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../lib/types/movie";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import { filterMovies } from "../searchMovies";

function makeExternalData(
  overrides: Partial<DetailedMovieData> = {},
): DetailedMovieData {
  return {
    adult: false,
    backdrop_path: "",
    budget: 0,
    directors: [],
    genres: [],
    homepage: "",
    id: 1,
    imdb_id: "",
    original_language: "en",
    original_title: "",
    overview: "",
    popularity: 0,
    poster_path: "",
    production_companies: [],
    production_countries: [],
    release_date: "2024-01-15",
    revenue: 0,
    runtime: 120,
    spoken_languages: [],
    status: "Released",
    tagline: "",
    title: "",
    video: false,
    vote_average: 7,
    vote_count: 100,
    ...overrides,
  };
}

function makeWork(
  overrides: Partial<DetailedWorkListItem> = {},
): DetailedWorkListItem {
  return {
    id: "1",
    type: WorkType.movie,
    title: "Test Movie",
    createdDate: "2024-06-15T00:00:00.000Z",
    externalData: makeExternalData(),
    ...overrides,
  };
}

// ---------- Basic search ----------

describe("filterMovies", () => {
  const movies = [
    makeWork({ title: "12 Angry Men" }),
    makeWork({ title: "The Empire Strikes Back" }),
    makeWork({ title: "Jaws" }),
  ];

  it("returns all items for empty query", () => {
    expect(filterMovies(movies, "")).toHaveLength(3);
  });

  it("whitespace query filters out all items (treated as search text)", () => {
    // "   " is truthy, so filterMovies tries to match titles containing "   "
    expect(filterMovies(movies, "   ")).toHaveLength(0);
  });

  it("filters by title text (case insensitive)", () => {
    const result = filterMovies(movies, "angry");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("12 Angry Men");
  });

  it("partial title match works", () => {
    const result = filterMovies(movies, "empire");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("The Empire Strikes Back");
  });

  it("returns empty when nothing matches", () => {
    expect(filterMovies(movies, "nonexistent")).toHaveLength(0);
  });
});

// ---------- title: filter ----------

describe("filterMovies title: filter", () => {
  const movies = [
    makeWork({ title: "Jaws" }),
    makeWork({ title: "Jaws 2" }),
    makeWork({ title: "Star Wars" }),
  ];

  it("filters by title: prefix", () => {
    const result = filterMovies(movies, "title:Jaws");
    expect(result).toHaveLength(2);
  });

  it("title: filter is case insensitive", () => {
    const result = filterMovies(movies, "title:jaws");
    expect(result).toHaveLength(2);
  });
});

// ---------- genre: filter ----------

describe("filterMovies genre: filter", () => {
  const movies = [
    makeWork({
      title: "Action Movie",
      externalData: makeExternalData({ genres: ["Action", "Thriller"] }),
    }),
    makeWork({
      title: "Comedy Movie",
      externalData: makeExternalData({ genres: ["Comedy"] }),
    }),
    makeWork({
      title: "Action Comedy",
      externalData: makeExternalData({ genres: ["Action", "Comedy"] }),
    }),
  ];

  it("filters by genre", () => {
    const result = filterMovies(movies, "genre:action");
    expect(result).toHaveLength(2);
  });

  it("partial genre match works", () => {
    const result = filterMovies(movies, "genre:thrill");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Action Movie");
  });

  it("excludes items without externalData", () => {
    const mixed = [
      makeWork({
        title: "No Data",
        externalData: undefined,
      }),
      makeWork({
        title: "Has Data",
        externalData: makeExternalData({ genres: ["Drama"] }),
      }),
    ];
    const result = filterMovies(mixed, "genre:drama");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Has Data");
  });
});

// ---------- company: filter ----------

describe("filterMovies company: filter", () => {
  it("filters by production company", () => {
    const movies = [
      makeWork({
        title: "Marvel Movie",
        externalData: makeExternalData({
          production_companies: ["Marvel Studios"],
        }),
      }),
      makeWork({
        title: "DC Movie",
        externalData: makeExternalData({
          production_companies: ["DC Films"],
        }),
      }),
    ];
    const result = filterMovies(movies, "company:marvel");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Marvel Movie");
  });
});

// ---------- director: filter ----------

describe("filterMovies director: filter", () => {
  it("filters by director name", () => {
    const movies = [
      makeWork({
        title: "Inception",
        externalData: makeExternalData({ directors: ["Christopher Nolan"] }),
      }),
      makeWork({
        title: "Jaws",
        externalData: makeExternalData({ directors: ["Steven Spielberg"] }),
      }),
    ];
    const result = filterMovies(movies, "director:nolan");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Inception");
  });
});

// ---------- description: filter ----------

describe("filterMovies description: filter", () => {
  it("filters by overview text", () => {
    const movies = [
      makeWork({
        title: "Space Movie",
        externalData: makeExternalData({
          overview: "A thrilling adventure in outer space",
        }),
      }),
      makeWork({
        title: "Love Movie",
        externalData: makeExternalData({
          overview: "A romantic comedy about love",
        }),
      }),
    ];
    const result = filterMovies(movies, "description:space");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Space Movie");
  });
});

// ---------- year: filter ----------

describe("filterMovies year: filter", () => {
  it("filters by review creation year", () => {
    const movies = [
      makeWork({
        title: "Old Review",
        createdDate: "2023-03-15T00:00:00.000Z",
      }),
      makeWork({
        title: "New Review",
        createdDate: "2024-08-15T00:00:00.000Z",
      }),
    ];
    const result = filterMovies(movies, "year:2024");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("New Review");
  });
});

// ---------- release: filter with comparison operators ----------

describe("filterMovies release: filter", () => {
  const movies = [
    makeWork({
      title: "Classic",
      externalData: makeExternalData({ release_date: "1950-06-01" }),
    }),
    makeWork({
      title: "Modern",
      externalData: makeExternalData({ release_date: "2000-06-01" }),
    }),
    makeWork({
      title: "Recent",
      externalData: makeExternalData({ release_date: "2020-06-01" }),
    }),
  ];

  it("exact year match", () => {
    const result = filterMovies(movies, "release:2000");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Modern");
  });

  it("less than operator", () => {
    const result = filterMovies(movies, "release:<2000");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Classic");
  });

  it("greater than operator", () => {
    const result = filterMovies(movies, "release:>2000");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Recent");
  });

  it("less than or equal operator", () => {
    const result = filterMovies(movies, "release:<=2000");
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.title).sort()).toEqual(["Classic", "Modern"]);
  });

  it("greater than or equal operator", () => {
    const result = filterMovies(movies, "release:>=2000");
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.title).sort()).toEqual(["Modern", "Recent"]);
  });

  it("excludes items without release_date", () => {
    const mixed = [
      makeWork({
        title: "No Date",
        externalData: makeExternalData({ release_date: "" }),
      }),
      makeWork({
        title: "Has Date",
        externalData: makeExternalData({ release_date: "2024-01-01" }),
      }),
    ];
    const result = filterMovies(mixed, "release:2024");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Has Date");
  });

  it("excludes items without externalData", () => {
    const mixed = [
      makeWork({ title: "No Data", externalData: undefined }),
      makeWork({
        title: "Has Data",
        externalData: makeExternalData({ release_date: "2024-01-01" }),
      }),
    ];
    const result = filterMovies(mixed, "release:2024");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Has Data");
  });
});

// ---------- Combined filters ----------

describe("filterMovies combined filters", () => {
  const movies = [
    makeWork({
      title: "Action Classic",
      createdDate: "2023-01-01T00:00:00.000Z",
      externalData: makeExternalData({ genres: ["Action"] }),
    }),
    makeWork({
      title: "Action New",
      createdDate: "2024-01-01T00:00:00.000Z",
      externalData: makeExternalData({ genres: ["Action"] }),
    }),
    makeWork({
      title: "Comedy New",
      createdDate: "2024-01-01T00:00:00.000Z",
      externalData: makeExternalData({ genres: ["Comedy"] }),
    }),
  ];

  it("combines genre: and year: with AND logic", () => {
    const result = filterMovies(movies, "genre:action year:2024");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Action New");
  });

  it("combines filter with free text search", () => {
    const result = filterMovies(movies, "genre:action Classic");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Action Classic");
  });
});
