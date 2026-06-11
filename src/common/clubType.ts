import axios from "axios";

import {
  OpenLibrarySearchDoc,
  OpenLibrarySearchResponse,
} from "@/../lib/types/book";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { DetailedWorkData, DetailedWorkListItem } from "@/../lib/types/lists";
import { TMDBPageResponse } from "@/../lib/types/movie";
import {
  dateMatcher,
  enumMatcher,
  numberMatcher,
  reviewAverageScore,
  type WorkMatcher,
} from "@/common/filterMatchers";
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
   * Decides whether a work row satisfies this filter. Owning the predicate here
   * keeps `filterWorks` media-agnostic — it never grows a branch per field.
   */
  readonly matches: WorkMatcher;
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
  /**
   * Comma-separated field list for the "no results" empty state, e.g.
   * "title, genre, company, director, or release year".
   */
  readonly searchableFieldsHint: string;
  /** Filters SearchFilterBar offers for this club type. */
  readonly filterOptions: readonly FilterOption[];
  /** Search the club type's external source for works to add. */
  readonly search: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<WorkSearchResult[]>;
}

// --- FilterOption builders --------------------------------------------------
// Each builder derives an option's `matches` predicate from a single selector,
// so the registry entries below stay declarative and can never omit their
// filtering logic.

/** Enum filter: one selector drives both suggestions and matching. */
function enumOption(
  key: string,
  label: string,
  placeholder: string,
  select: (data: DetailedWorkData | undefined) => string[],
): FilterOption {
  return {
    key,
    label,
    type: "enum",
    placeholder,
    matches: enumMatcher(select),
    suggestions: select,
  };
}

/** Numeric filter with `> = <` comparators. */
function numberOption(
  key: string,
  label: string,
  placeholder: string,
  select: (work: DetailedWorkListItem) => number | string | undefined,
): FilterOption {
  return {
    key,
    label,
    type: "number",
    placeholder,
    matches: numberMatcher(select),
  };
}

/** Date filter with `> = <` comparators. */
function dateOption(
  key: string,
  label: string,
  placeholder: string,
  select: (work: DetailedWorkListItem) => string | undefined,
): FilterOption {
  return {
    key,
    label,
    type: "date",
    placeholder,
    matches: dateMatcher(select),
  };
}

// Filters shared by every club type (scores and review metadata).
const averageScoreOption = numberOption(
  "average_score",
  "Average Score",
  "Enter score",
  reviewAverageScore,
);
const reviewDateOption = dateOption(
  "review_date",
  "Review Date",
  "Enter a year",
  (work) => work.createdDate,
);

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
    searchableFieldsHint: "title, genre, company, director, or release year",
    filterOptions: [
      enumOption(
        "genre",
        "Genre",
        "Select a genre",
        (data) => asMovie(data)?.genres ?? [],
      ),
      averageScoreOption,
      enumOption(
        "company",
        "Production Company",
        "Select a company",
        (data) => asMovie(data)?.production_companies ?? [],
      ),
      enumOption(
        "director",
        "Director",
        "Select a director",
        (data) => asMovie(data)?.directors?.map((d) => d.name) ?? [],
      ),
      reviewDateOption,
      dateOption(
        "release_date",
        "Release Date",
        "Enter a year",
        (work) => asMovie(work.externalData)?.release_date,
      ),
      numberOption(
        "runtime",
        "Runtime (min)",
        "Enter minutes",
        (work) => asMovie(work.externalData)?.runtime,
      ),
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
    searchableFieldsHint: "title, author, subject, or published year",
    filterOptions: [
      enumOption(
        "author",
        "Author",
        "Select an author",
        (data) => asBook(data)?.authors ?? [],
      ),
      enumOption(
        "subject",
        "Subject",
        "Select a subject",
        (data) => asBook(data)?.subjects ?? [],
      ),
      averageScoreOption,
      reviewDateOption,
      numberOption(
        "first_publish_year",
        "First Published",
        "Enter a year",
        (work) => asBook(work.externalData)?.firstPublishYear,
      ),
      numberOption(
        "pages",
        "Pages",
        "Enter page count",
        (work) => asBook(work.externalData)?.numberOfPages,
      ),
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
