import type { DetailedBookData } from "../../../../lib/types/book";
import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedMovieData } from "../../../../lib/types/movie";
import type { BookData, HistogramData, MovieData } from "../types";

/** Shorthand for the `{ name, profilePath }` shape TMDB people arrive in. */
export function person(name: string): { name: string; profilePath: string | null } {
  return { name, profilePath: null };
}

export function makeExternalMovie(overrides: Partial<DetailedMovieData> = {}): DetailedMovieData {
  return {
    kind: "movie",
    actors: [],
    castNames: [],
    majorCastNames: [],
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
    release_date: "2024-01-01",
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

export function makeExternalBook(overrides: Partial<DetailedBookData> = {}): DetailedBookData {
  return {
    kind: "book",
    title: "Test Book",
    authors: [],
    subjects: [],
    ...overrides,
  };
}

export function makeMovie(overrides: Partial<MovieData> = {}): MovieData {
  return {
    id: "1",
    type: WorkType.movie,
    title: "Test Movie",
    createdDate: "2024-01-01T00:00:00.000Z",
    externalId: undefined,
    imageUrl: undefined,
    genres: [],
    production_companies: [],
    production_countries: [],
    average: 7,
    userScores: {},
    scores: {},
    externalData: makeExternalMovie(),
    dateWatched: "1/1/2024",
    ...overrides,
  };
}

// No externalData by default: book statistics are score-only, so a book
// review without Google Books metadata still counts.
export function makeBook(overrides: Partial<BookData> = {}): BookData {
  return {
    id: "b1",
    type: WorkType.book,
    title: "Test Book",
    createdDate: "2024-01-01T00:00:00.000Z",
    externalId: undefined,
    imageUrl: undefined,
    average: 7,
    userScores: {},
    scores: {},
    dateWatched: "1/1/2024",
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: "m1",
    email: "test@test.com",
    name: "Test User",
    image: "",
    role: "member",
    ...overrides,
  };
}

/**
 * One scored movie review, in the shape `/api/club/:id/list/reviews` returns.
 *
 * The shared `src/mocks/data/reviews.json` fixture predates the `kind`
 * discriminant on `externalData`, and `useStatisticsData` drops any movie whose
 * metadata it cannot narrow — so view tests that need statistics to actually
 * appear serve this instead.
 */
export const SCORED_MOVIE_REVIEW = {
  id: "1",
  title: "Dune",
  type: "movie",
  createdDate: "2024-05-28T04:46:37.751Z",
  imageUrl: "https://image.tmdb.org/dune.jpg",
  externalId: "438631",
  scores: {
    "2": { id: "s1", created_date: "2024-05-28T04:46:37.751Z", score: 9 },
    average: { id: "avg", created_date: "2024-05-28T04:46:37.751Z", score: 9 },
  },
  externalData: {
    kind: "movie",
    castNames: [],
    majorCastNames: [],
    directors: [],
    genres: ["Sci-Fi"],
    production_companies: [],
    production_countries: [],
    release_date: "2021-10-22",
    runtime: 155,
    vote_average: 8,
  },
};

/**
 * An 11-bin (0–10) histogram, matching what `createHistogramData` produces, with
 * every listed member's per-bin counts zeroed. Widgets only pass this through to
 * the chart builder, so the counts rarely need to be meaningful.
 */
export function makeHistogram(memberIds: string[] = []): HistogramData[] {
  return Array.from({ length: 11 }, (_unused, bin) => {
    const row: HistogramData = { bin };
    for (const id of memberIds) row[id] = 0;
    return row;
  });
}
