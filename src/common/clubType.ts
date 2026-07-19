import axios from "axios";

import { ensure, hasValue, isDefined } from "@/../lib/checks/checks";
import { secureImageUrl, sortVolumesByPopularity } from "@/../lib/googleBooks";
import {
  GoogleBooksSearchResponse,
  GoogleBooksVolume,
} from "@/../lib/types/book";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { DetailedWorkData, DetailedWorkListItem } from "@/../lib/types/lists";
import { TMDBMovieData, TMDBPageResponse } from "@/../lib/types/movie";
import {
  dateMatcher,
  enumMatcher,
  numberMatcher,
  reviewAverageScore,
  type WorkMatcher,
} from "@/common/filterMatchers";
import { asBook, asMovie, formatRuntime } from "@/common/workDisplay";

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w154";
const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
export const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1";

/**
 * A media-agnostic search result. `externalId` is the provider's stable
 * identifier (TMDB movie id or Google Books volume id) and `imageUrl` is a
 * fully-qualified poster/cover URL — both ready to drop into a ListInsertDto.
 */
export interface WorkSearchResult {
  externalId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

/** Map a TMDB movie (search or find result) to a WorkSearchResult. */
export function movieToSearchResult(movie: TMDBMovieData): WorkSearchResult {
  return {
    externalId: String(movie.id),
    title: movie.title,
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imageUrl: movie.poster_path
      ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
      : undefined,
  };
}

async function searchMovies(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBPageResponse>(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map(movieToSearchResult);
}

/** Map a Google Books volume (search or browse) to a WorkSearchResult. */
export function volumeToResult(volume: GoogleBooksVolume): WorkSearchResult {
  const info = volume.volumeInfo;
  const thumbnail =
    info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return {
    externalId: volume.id,
    title: info?.title ?? "Untitled",
    subtitle:
      [info?.authors?.[0], info?.publishedDate?.slice(0, 4)]
        .filter(hasValue)
        .join(" · ") || undefined,
    imageUrl: hasValue(thumbnail) ? secureImageUrl(thumbnail) : undefined,
  };
}

/**
 * Query Google Books volumes and map to WorkSearchResults. `sortVolumes` runs
 * on the raw volumes, before mapping discards fields like `ratingsCount`.
 */
export async function fetchBookVolumes(
  params: Record<string, string>,
  signal?: AbortSignal,
  sortVolumes?: (volumes: GoogleBooksVolume[]) => GoogleBooksVolume[],
): Promise<WorkSearchResult[]> {
  const searchParams = new URLSearchParams({
    printType: "books",
    // Keyless requests work at low rate limits; an empty key param is a 400.
    ...(hasValue(GOOGLE_BOOKS_KEY) ? { key: GOOGLE_BOOKS_KEY } : {}),
    ...params,
  });
  const { data } = await axios.get<GoogleBooksSearchResponse>(
    `${GOOGLE_BOOKS_BASE_URL}/volumes?${searchParams.toString()}`,
    { signal },
  );
  const volumes = data.items ?? [];
  return (sortVolumes ? sortVolumes(volumes) : volumes).map(volumeToResult);
}

async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<WorkSearchResult[]> {
  return fetchBookVolumes(
    { q: query, maxResults: "20" },
    signal,
    sortVolumesByPopularity,
  );
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
  /** Copy and icons for the statistics feature. */
  readonly stats: StatsConfig;
  /** Per-type extraction of the strings shown in the details drawers. */
  readonly display: WorkDisplay;
  /**
   * How alike two works of this club's type are, for Score Assist's pivot
   * selection. Missing or mismatched-kind metadata scores 0.
   */
  readonly similarity: (
    target: DetailedWorkData | undefined,
    candidate: DetailedWorkData | undefined,
  ) => number;
}

/**
 * The media-appropriate display strings a details drawer renders for one work.
 * Each field owns its own `asMovie`/`asBook` narrowing so the shared helpers
 * ({@link workSubtitle} etc.) dispatch on the work's kind instead of branching.
 */
export interface WorkDisplay {
  /** Short subtitle: release year (movies) / first-published year (books). */
  readonly subtitle: (data: DetailedWorkData | undefined) => string | undefined;
  /** One-line hero meta: "2h 35m · Adventure" / "Frank Herbert · 412 pages". */
  readonly metaLine: (data: DetailedWorkData | undefined) => string | undefined;
  /** Long-form blurb: the TMDB overview / the book description. */
  readonly overview: (data: DetailedWorkData | undefined) => string | undefined;
}

/**
 * Everything the statistics widgets need to render club-type-specific copy and
 * icons. Lives on the registry so a widget reads `config.stats.countLabel`
 * instead of branching on `clubType === ClubType.movie` — a new club type only
 * has to fill this in.
 */
export interface StatsConfig {
  /** Capitalized plural noun for widget headers ("Movies", "Books"). */
  readonly pluralNoun: string;
  /** Label under the total-count stat ("movies watched", "books read"). */
  readonly countLabel: string;
  /** Icon for the total-count stat (may differ from the club icon). */
  readonly countIcon: string;
  /** Title used when sharing the statistics page. */
  readonly shareTitle: string;
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

// --- Per-type display extraction --------------------------------------------

const movieDisplay: WorkDisplay = {
  subtitle: (data) => {
    const movie = asMovie(data);
    return movie?.release_date !== undefined && movie.release_date.length >= 4
      ? movie.release_date.slice(0, 4)
      : undefined;
  },
  metaLine: (data) => {
    const movie = asMovie(data);
    if (movie === undefined) return undefined;
    const parts: string[] = [];
    if (movie.runtime !== undefined && movie.runtime > 0) {
      parts.push(formatRuntime(movie.runtime));
    }
    if (movie.genres !== undefined && movie.genres.length > 0) {
      parts.push(movie.genres.join(", "));
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asMovie(data)?.overview,
};

const bookDisplay: WorkDisplay = {
  subtitle: (data) => {
    const book = asBook(data);
    return book?.firstPublishYear !== undefined
      ? String(book.firstPublishYear)
      : undefined;
  },
  metaLine: (data) => {
    const book = asBook(data);
    if (book === undefined) return undefined;
    const parts: string[] = [];
    if (book.authors.length > 0) parts.push(book.authors.join(", "));
    if (book.numberOfPages !== undefined && book.numberOfPages > 0) {
      parts.push(`${book.numberOfPages} pages`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asBook(data)?.description,
};

// --- Per-type similarity (Score Assist pivot selection) ---------------------
// How strongly a shared primary credit (director / author) counts towards
// similarity, relative to a shared category (genre / subject).
const PRIMARY_CREDIT_WEIGHT = 3;
const CATEGORY_WEIGHT = 1;

// Case-insensitive: Google Books subjects vary in casing between volumes.
function sharedCount(a: readonly string[], b: readonly string[]): number {
  const normalized = new Set(a.map((value) => value.toLowerCase()));
  return b.filter((value) => normalized.has(value.toLowerCase())).length;
}

const movieSimilarity: ClubTypeConfig["similarity"] = (target, candidate) => {
  const a = asMovie(target);
  const b = asMovie(candidate);
  if (a === undefined || b === undefined) return 0;
  return (
    sharedCount(
      a.directors.map((director) => director.name),
      b.directors.map((director) => director.name),
    ) *
      PRIMARY_CREDIT_WEIGHT +
    sharedCount(a.genres, b.genres) * CATEGORY_WEIGHT
  );
};

const bookSimilarity: ClubTypeConfig["similarity"] = (target, candidate) => {
  const a = asBook(target);
  const b = asBook(candidate);
  if (a === undefined || b === undefined) return 0;
  return (
    sharedCount(a.authors, b.authors) * PRIMARY_CREDIT_WEIGHT +
    sharedCount(a.subjects, b.subjects) * CATEGORY_WEIGHT
  );
};

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
    searchableFieldsHint:
      "title, genre, company, director, actor, or release year",
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
      enumOption(
        "actor",
        "Actor",
        "Select an actor",
        (data) => asMovie(data)?.actors?.map((a) => a.name) ?? [],
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
    stats: {
      pluralNoun: "Movies",
      countLabel: "movies watched",
      countIcon: "filmstrip",
      shareTitle: "Movie Club Statistics",
    },
    display: movieDisplay,
    similarity: movieSimilarity,
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
    stats: {
      pluralNoun: "Books",
      countLabel: "books read",
      countIcon: "book-open-page-variant-outline",
      shareTitle: "Book Club Statistics",
    },
    display: bookDisplay,
    similarity: bookSimilarity,
  },
};

export function clubTypeConfig(type: ClubType): ClubTypeConfig {
  return CLUB_TYPE_CONFIG[type];
}

/** A club's media type maps 1:1 to the work type its works use. */
export function workTypeForClub(type: ClubType): WorkType {
  return clubTypeConfig(type).workType;
}

/**
 * Registry entry for the club type whose works use the given work type — the
 * inverse of {@link workTypeForClub} (the mapping is 1:1).
 */
export function clubTypeConfigForWorkType(type: WorkType): ClubTypeConfig {
  return ensure(
    Object.values(CLUB_TYPE_CONFIG).find((config) => config.workType === type),
    `No club type config for work type ${type}`,
  );
}

/** Material Design Icon name representing a club's media type. */
export function clubTypeIcon(type: ClubType): string {
  return clubTypeConfig(type).icon;
}

/** Human label for a club's media type (e.g. for tooltips/aria). */
export function clubTypeLabel(type: ClubType): string {
  return clubTypeConfig(type).label;
}

/** Statistics-feature copy and icons for a club's media type. */
export function clubTypeStats(type: ClubType): StatsConfig {
  return clubTypeConfig(type).stats;
}

// A work self-identifies its media type via `externalData.kind`, so display
// helpers can route to the right registry entry without their callers knowing
// the club type. Both maps are exhaustive (a new type won't compile until added).
const CLUB_TYPE_BY_KIND: Record<DetailedWorkData["kind"], ClubType> = {
  movie: ClubType.movie,
  book: ClubType.book,
};

const CLUB_TYPE_BY_WORK_TYPE: Record<WorkType, ClubType> = {
  [WorkType.movie]: ClubType.movie,
  [WorkType.book]: ClubType.book,
};

function workDisplay(
  data: DetailedWorkData | undefined,
): WorkDisplay | undefined {
  if (data === undefined) return undefined;
  // Legacy/partially-cached works can arrive without a `kind` discriminant, so
  // guard the lookup rather than assume it resolves (returns undefined copy,
  // matching the pre-registry asMovie/asBook fallthrough).
  const type = CLUB_TYPE_BY_KIND[data.kind];
  return isDefined(type) ? clubTypeConfig(type).display : undefined;
}

/** A short, media-appropriate subtitle (release/first-published year). */
export function workSubtitle(
  data: DetailedWorkData | undefined,
): string | undefined {
  return workDisplay(data)?.subtitle(data);
}

/**
 * A one-line, media-appropriate summary for the details drawers: "2h 35m ·
 * Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages" (books).
 */
export function workMetaLine(
  data: DetailedWorkData | undefined,
): string | undefined {
  return workDisplay(data)?.metaLine(data);
}

/** The long-form blurb (TMDB overview / book description). */
export function workOverview(
  data: DetailedWorkData | undefined,
): string | undefined {
  return workDisplay(data)?.overview(data);
}

/**
 * How alike two works are, for preferring familiar comparison points while
 * Score Assist binary-searches a score. Missing or mismatched-kind metadata
 * scores 0, so pivot selection degrades gracefully to score-midpoint distance.
 */
export function workSimilarity(
  type: WorkType,
  target: DetailedWorkData | undefined,
  candidate: DetailedWorkData | undefined,
): number {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[type]).similarity(
    target,
    candidate,
  );
}
