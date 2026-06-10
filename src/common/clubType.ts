import axios from "axios";

import {
  OpenLibrarySearchDoc,
  OpenLibrarySearchResponse,
} from "@/../lib/types/book";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { DetailedWorkData } from "@/../lib/types/lists";
import { TMDBPageResponse } from "@/../lib/types/movie";
import { asBook, asMovie } from "@/common/workDisplay";

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w154";

/**
 * A media-agnostic search result. `externalId` is the provider's stable
 * identifier (TMDB movie id or OpenLibrary Work key) and `imageUrl` is a
 * fully-qualified poster/cover URL — both ready to drop into a ListInsertDto.
 */
export interface WorkSearchResult {
  externalId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

async function searchMovies(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBPageResponse>(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map((movie) => ({
    externalId: String(movie.id),
    title: movie.title,
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imageUrl: movie.poster_path
      ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
      : undefined,
  }));
}

/** Map an OpenLibrary work doc (search or trending) to a WorkSearchResult. */
export function bookDocToResult(doc: OpenLibrarySearchDoc): WorkSearchResult {
  return {
    externalId: doc.key.replace("/works/", ""),
    title: doc.title,
    subtitle:
      [doc.author_name?.[0], doc.first_publish_year]
        .filter((part) => part !== undefined && part !== "")
        .join(" · ") || undefined,
    imageUrl:
      doc.cover_i !== undefined
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : undefined,
  };
}

async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<OpenLibrarySearchResponse>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i`,
    { signal },
  );
  return data.docs.map(bookDocToResult);
}

/**
 * A single filter exposed by SearchFilterBar. The set of options a club shows
 * is driven entirely by its club type (see {@link ClubTypeConfig.filterOptions}),
 * so movie-only fields never appear for book clubs and vice versa.
 */
export interface FilterOption {
  readonly key: string;
  readonly label: string;
  readonly type: "enum" | "number" | "date";
  readonly placeholder: string;
  /**
   * Enum options only: extract the aggregatable values from one work's
   * externalData (e.g. genres, author names) so SearchFilterBar can build
   * frequency-ranked suggestions. Returns `[]` for works of another kind.
   */
  readonly suggestions?: (data: DetailedWorkData | undefined) => string[];
}

export interface ClubTypeConfig {
  readonly clubType: ClubType;
  /** The work type a club's items use (1:1 with the club type). */
  readonly workType: WorkType;
  /** Material Design Icon name representing the media type. */
  readonly icon: string;
  /** Human label, e.g. for tooltips/aria ("Movie club"). */
  readonly label: string;
  /** Singular noun for one item of the media ("movie", "book"). */
  readonly noun: string;
  /** Empty-state hint shown in the add/search prompt. */
  readonly searchHint: string;
  /** Filters SearchFilterBar offers for this club type. */
  readonly filterOptions: readonly FilterOption[];
  /** Search the club type's external source for works to add. */
  readonly search: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<WorkSearchResult[]>;
}

/**
 * Everything that varies by a club's media type, in one place. To add a third
 * club type: add the enum value (migration + codegen) and one entry here — copy,
 * icons, search, and filters all flow from this registry rather than scattered
 * `if (clubType === ...)` branches.
 */
export const CLUB_TYPE_CONFIG: Record<ClubType, ClubTypeConfig> = {
  [ClubType.movie]: {
    clubType: ClubType.movie,
    workType: WorkType.movie,
    icon: "movie-open-outline",
    label: "Movie club",
    noun: "movie",
    searchHint: "Search for a movie to add.",
    filterOptions: [
      {
        key: "genre",
        label: "Genre",
        type: "enum",
        placeholder: "Select a genre",
        suggestions: (data) => asMovie(data)?.genres ?? [],
      },
      {
        key: "average_score",
        label: "Average Score",
        type: "number",
        placeholder: "Enter score",
      },
      {
        key: "company",
        label: "Production Company",
        type: "enum",
        placeholder: "Select a company",
        suggestions: (data) => asMovie(data)?.production_companies ?? [],
      },
      {
        key: "director",
        label: "Director",
        type: "enum",
        placeholder: "Select a director",
        suggestions: (data) =>
          asMovie(data)?.directors?.map((d) => d.name) ?? [],
      },
      {
        key: "review_date",
        label: "Review Date",
        type: "date",
        placeholder: "Enter a year",
      },
      {
        key: "release_date",
        label: "Release Date",
        type: "date",
        placeholder: "Enter a year",
      },
      {
        key: "runtime",
        label: "Runtime (min)",
        type: "number",
        placeholder: "Enter minutes",
      },
    ],
    search: searchMovies,
  },
  [ClubType.book]: {
    clubType: ClubType.book,
    workType: WorkType.book,
    icon: "book-open-page-variant-outline",
    label: "Book club",
    noun: "book",
    searchHint: "Search for a book to add.",
    filterOptions: [
      {
        key: "author",
        label: "Author",
        type: "enum",
        placeholder: "Select an author",
        suggestions: (data) => asBook(data)?.authors ?? [],
      },
      {
        key: "subject",
        label: "Subject",
        type: "enum",
        placeholder: "Select a subject",
        suggestions: (data) => asBook(data)?.subjects ?? [],
      },
      {
        key: "average_score",
        label: "Average Score",
        type: "number",
        placeholder: "Enter score",
      },
      {
        key: "review_date",
        label: "Review Date",
        type: "date",
        placeholder: "Enter a year",
      },
      {
        key: "first_publish_year",
        label: "First Published",
        type: "number",
        placeholder: "Enter a year",
      },
      {
        key: "pages",
        label: "Pages",
        type: "number",
        placeholder: "Enter page count",
      },
    ],
    search: searchBooks,
  },
};

export function clubTypeConfig(type: ClubType): ClubTypeConfig {
  return CLUB_TYPE_CONFIG[type];
}

/** A club's media type maps 1:1 to the work type its works use. */
export function workTypeForClub(type: ClubType): WorkType {
  return clubTypeConfig(type).workType;
}

/** Material Design Icon name representing a club's media type. */
export function clubTypeIcon(type: ClubType): string {
  return clubTypeConfig(type).icon;
}

/** Human label for a club's media type (e.g. for tooltips/aria). */
export function clubTypeLabel(type: ClubType): string {
  return clubTypeConfig(type).label;
}
