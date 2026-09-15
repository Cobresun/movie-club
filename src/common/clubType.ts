import axios from "axios";

import { hasValue, isDefined } from "@/../lib/checks/checks";
import { secureImageUrl, sortVolumesByPopularity } from "@/../lib/googleBooks";
import { GoogleBooksSearchResponse, GoogleBooksVolume } from "@/../lib/types/book";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { DetailedWorkListItem, WorkDataSummary } from "@/../lib/types/lists";
import { TMDBPageResponse } from "@/../lib/types/movie";
import { episodeCode, TMDBTvPageResponse, TvDataSummary } from "@/../lib/types/tv";
import type { FilterOptionType } from "@/common/components/filterTypes";
import {
  dateMatcher,
  enumMatcher,
  numberMatcher,
  reviewAverageScore,
  yearMatcher,
  type WorkMatcher,
} from "@/common/filterMatchers";
import { asBook, asMovie, asTv, formatRuntime } from "@/common/workDisplay";

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

async function searchMovies(query: string, signal?: AbortSignal): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBPageResponse>(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map((movie) => ({
    externalId: String(movie.id),
    title: movie.title,
    subtitle: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : undefined,
  }));
}

/**
 * TV search returns shows, never seasons or episodes: a club adds a series and
 * works down into it, so the only address a search result carries is a bare
 * show id.
 */
async function searchTvShows(query: string, signal?: AbortSignal): Promise<WorkSearchResult[]> {
  const { data } = await axios.get<TMDBTvPageResponse>(
    `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`,
    { signal },
  );
  return data.results.map((show) => ({
    externalId: String(show.id),
    title: show.name,
    subtitle: hasValue(show.first_air_date) ? show.first_air_date.slice(0, 4) : undefined,
    imageUrl: hasValue(show.poster_path) ? `${TMDB_IMAGE_BASE}${show.poster_path}` : undefined,
  }));
}

/** Map a Google Books volume (search or browse) to a WorkSearchResult. */
export function volumeToResult(volume: GoogleBooksVolume): WorkSearchResult {
  const info = volume.volumeInfo;
  const thumbnail = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return {
    externalId: volume.id,
    title: info?.title ?? "Untitled",
    subtitle:
      [info?.authors?.[0], info?.publishedDate?.slice(0, 4)].filter(hasValue).join(" · ") ||
      undefined,
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

async function searchBooks(query: string, signal?: AbortSignal): Promise<WorkSearchResult[]> {
  return fetchBookVolumes({ q: query, maxResults: "20" }, signal, sortVolumesByPopularity);
}

/**
 * A single filter exposed by SearchFilterBar. The set of options a club shows
 * is driven entirely by its club type (see {@link ClubTypeConfig.filterOptions}),
 * so movie-only fields never appear for book clubs and vice versa.
 */
export interface FilterOption {
  readonly key: string;
  readonly label: string;
  readonly type: FilterOptionType;
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
  readonly suggestions?: (data: WorkDataSummary | undefined) => string[];
  /**
   * Year options only: the work's year, used both to match and to plot the
   * distribution the picker draws behind its scrubber.
   */
  readonly year?: (work: DetailedWorkListItem) => number | undefined;
}

export interface ClubTypeConfig {
  readonly clubType: ClubType;
  /** The work type a club's items use (1:1 with the club type). */
  readonly workType: WorkType;
  /** Material Design Icon name representing the media type. */
  readonly icon: string;
  /** Human label, e.g. for tooltips/aria ("Movie club"). */
  readonly label: string;
  /** What a club of this type reviews, in the plural — the club-type picker's
   * option ("Movies", "Books", "TV shows"). */
  readonly pluralLabel: string;
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
  readonly search: (query: string, signal?: AbortSignal) => Promise<WorkSearchResult[]>;
  /** Copy and icons for the statistics feature. */
  readonly stats: StatsConfig;
  /** Whether this club type can use the awards feature. */
  readonly supportsAwards: boolean;
  /** Copy for the invite handoff shown after a club is created. */
  readonly invite: InviteConfig;
  /** Per-type extraction of the strings shown in the details drawers. */
  readonly display: WorkDisplay;
  /**
   * Whether a reviewed work is one of the units statistics and review facts
   * count. Every movie and book is. A TV club counts episodes: a season or
   * show it scored on its own would otherwise count the same series again.
   */
  readonly isScoredUnit: (data: WorkDataSummary | undefined) => boolean;
  /**
   * Build a similarity scorer for Score Assist's pivot selection, calibrated to
   * a candidate pool (its tag frequencies weight the overlaps). The returned
   * scorer maps a (target, candidate) pair to [0,1]; missing or mismatched-kind
   * metadata scores 0.
   */
  readonly makeSimilarity: (
    corpus: readonly (WorkDataSummary | undefined)[],
  ) => WorkSimilarityScorer;
}

/**
 * The media-appropriate display strings a details drawer renders for one work.
 * Each field owns its own `asMovie`/`asBook` narrowing so the shared helpers
 * ({@link workSubtitle} etc.) dispatch on the work's kind instead of branching.
 */
export interface WorkDisplay {
  /** Short subtitle: release year (movies) / first-published year (books). */
  readonly subtitle: (data: WorkDataSummary | undefined) => string | undefined;
  /** One-line hero meta: "2h 35m · Adventure" / "Frank Herbert · 412 pages". */
  readonly metaLine: (data: WorkDataSummary | undefined) => string | undefined;
  /** Long-form blurb: the TMDB overview / the book description. */
  readonly overview: (data: WorkDataSummary | undefined) => string | undefined;
  /** What one work is called ("Rate this season"), for media whose works come
   * at more than one level. Others fall back to the club type's `noun`. */
  readonly noun?: (data: WorkDataSummary | undefined) => string | undefined;
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

/**
 * Copy the invite screen hands to the OS share sheet. The link itself is
 * media-agnostic; only the sentence describing what the recipient is joining
 * changes with the club's media type.
 */
export interface InviteConfig {
  /** Body text offered alongside the invite URL when sharing natively. */
  readonly shareText: string;
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
  select: (data: WorkDataSummary | undefined) => string[],
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

/**
 * A calendar-year filter: one year or an inclusive span of them. Years are
 * compared as numbers, so a work only needs to yield a year — no date parsing,
 * and no month/day precision the picker would have to invent.
 */
function yearOption(
  key: string,
  label: string,
  placeholder: string,
  select: (work: DetailedWorkListItem) => number | undefined,
): FilterOption {
  return {
    key,
    label,
    type: "year",
    placeholder,
    matches: yearMatcher(select),
    year: select,
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
    return book?.firstPublishYear !== undefined ? String(book.firstPublishYear) : undefined;
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

function tvYear(tv: TvDataSummary): string | undefined {
  return hasValue(tv.airDate) && tv.airDate.length >= 4 ? tv.airDate.slice(0, 4) : undefined;
}

const tvDisplay: WorkDisplay = {
  subtitle: (data) => {
    const tv = asTv(data);
    if (tv === undefined) return undefined;
    const year = tvYear(tv);
    // An episode leads with its code: "S01E04" is how a club refers to it,
    // and the year alone would not distinguish it from its 18 siblings.
    if (tv.seasonNumber !== undefined && tv.episodeNumber !== undefined) {
      const code = episodeCode(tv.seasonNumber, tv.episodeNumber);
      return hasValue(year) ? `${code} · ${year}` : code;
    }
    return year;
  },
  metaLine: (data) => {
    const tv = asTv(data);
    if (tv === undefined) return undefined;
    const parts: string[] = [];
    if (tv.level === "episode" && isDefined(tv.runtime) && tv.runtime > 0) {
      parts.push(formatRuntime(tv.runtime));
    }
    if (tv.level === "season" && isDefined(tv.episodeCount) && tv.episodeCount > 0) {
      parts.push(`${tv.episodeCount} episodes`);
    }
    if (tv.level === "show" && isDefined(tv.numberOfSeasons) && tv.numberOfSeasons > 0) {
      parts.push(`${tv.numberOfSeasons} seasons`);
    }
    if (tv.genres.length > 0) parts.push(tv.genres.join(", "));
    return parts.length > 0 ? parts.join(" · ") : undefined;
  },
  overview: (data) => asTv(data)?.overview,
  noun: (data) => asTv(data)?.level,
};

// --- Per-type similarity (Score Assist pivot selection) ---------------------
// Score Assist ranks comparison candidates by how "alike" they feel to the work
// being reviewed, so the user compares familiar things. A scorer returns a value
// in [0,1] (0 = nothing in common, 1 = identical on every measured axis): a
// weighted average of per-field overlaps. Per-field weights encode that a shared
// director/author counts far more than a shared genre/subject. Set overlaps use
// a weighted Jaccard (intersection over union, so a work with many tags isn't
// spuriously "similar" to everything), with each tag's weight coming from its
// inverse document frequency in the club's own catalogue — sharing a rare genre
// counts for more than sharing a ubiquitous one ("Drama"). Era/length signals
// decay continuously with distance rather than snapping at a bucket boundary.

/** A comparison scorer specialised to one candidate pool (see makeSimilarity). */
export type WorkSimilarityScorer = (
  target: WorkDataSummary | undefined,
  candidate: WorkDataSummary | undefined,
) => number;

const lower = (value: string): string => value.toLowerCase();

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Years of separation at which the release/publish-era signal halves. */
const ERA_HALF_LIFE_YEARS = 15;
/** Page-count difference at which the book-length signal halves. */
const PAGE_HALF_LIFE = 300;

// Movie field weights: a shared director dominates, cast/studio/genre are
// secondary, era/language are gentle nudges. Books mirror the shape.
const MOVIE_FIELD_WEIGHTS = {
  director: 5,
  cast: 2,
  company: 1.5,
  genre: 2,
  era: 1,
  language: 0.5,
} as const;
const BOOK_FIELD_WEIGHTS = {
  author: 5,
  subject: 2.5,
  era: 1,
  length: 0.5,
} as const;

/**
 * Build an inverse-document-frequency lookup for one tag field over a catalogue.
 * Smoothed so an empty corpus (or a tag no work has) weighs 1 — i.e. the scorer
 * degrades to a plain Jaccard — while rarer tags weigh above 1.
 */
function buildIdf(
  corpus: readonly (WorkDataSummary | undefined)[],
  extract: (data: WorkDataSummary | undefined) => readonly string[],
): (tag: string) => number {
  const documentFrequency = new Map<string, number>();
  for (const data of corpus) {
    for (const tag of new Set(extract(data).map(lower))) {
      documentFrequency.set(tag, (documentFrequency.get(tag) ?? 0) + 1);
    }
  }
  const total = corpus.length;
  return (tag) => Math.log((total + 1) / ((documentFrequency.get(lower(tag)) ?? 0) + 1)) + 1;
}

/**
 * IDF-weighted Jaccard overlap of two tag sets, in [0,1]. Returns 0 when either
 * side is empty — two works that both list no genres share no signal, they are
 * not "identical".
 */
function weightedJaccard(
  a: readonly string[],
  b: readonly string[],
  idf: (tag: string) => number,
): number {
  const setA = new Set(a.map(lower));
  const setB = new Set(b.map(lower));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  let union = 0;
  for (const tag of new Set([...setA, ...setB])) {
    const weight = idf(tag);
    union += weight;
    if (setA.has(tag) && setB.has(tag)) intersection += weight;
  }
  return union === 0 ? 0 : intersection / union;
}

/** Exponential closeness in [0,1]: 1 when equal, 0.5 at one half-life apart. */
function proximityDecay(a: number | undefined, b: number | undefined, halfLife: number): number {
  if (!isDefined(a) || !isDefined(b)) return 0;
  return Math.exp((-Math.abs(a - b) * Math.LN2) / halfLife);
}

function names(people: readonly { name: string }[]): string[] {
  return people.map((person) => person.name);
}

function releaseYear(data: { release_date?: string }): number | undefined {
  const year = hasValue(data.release_date)
    ? Number.parseInt(data.release_date.slice(0, 4), 10)
    : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
}

const makeMovieSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const directorIdf = buildIdf(corpus, (d) => names(asMovie(d)?.directors ?? []));
  // Bulk payloads carry cast names only (castNames); full actor objects live in
  // the per-work detail payload and aren't available for pivot scoring.
  const castIdf = buildIdf(corpus, (d) => asMovie(d)?.castNames ?? []);
  const companyIdf = buildIdf(corpus, (d) => asMovie(d)?.production_companies ?? []);
  const genreIdf = buildIdf(corpus, (d) => asMovie(d)?.genres ?? []);
  const totalWeight = sum(Object.values(MOVIE_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asMovie(target);
    const b = asMovie(candidate);
    if (a === undefined || b === undefined) return 0;
    const sameLanguage =
      hasValue(a.original_language) && a.original_language === b.original_language;
    const weighted =
      MOVIE_FIELD_WEIGHTS.director *
        weightedJaccard(names(a.directors), names(b.directors), directorIdf) +
      MOVIE_FIELD_WEIGHTS.cast * weightedJaccard(a.castNames, b.castNames, castIdf) +
      MOVIE_FIELD_WEIGHTS.company *
        weightedJaccard(a.production_companies, b.production_companies, companyIdf) +
      MOVIE_FIELD_WEIGHTS.genre * weightedJaccard(a.genres, b.genres, genreIdf) +
      MOVIE_FIELD_WEIGHTS.era *
        proximityDecay(releaseYear(a), releaseYear(b), ERA_HALF_LIFE_YEARS) +
      MOVIE_FIELD_WEIGHTS.language * (sameLanguage ? 1 : 0);
    return weighted / totalWeight;
  };
};

const makeBookSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const authorIdf = buildIdf(corpus, (d) => asBook(d)?.authors ?? []);
  const subjectIdf = buildIdf(corpus, (d) => asBook(d)?.subjects ?? []);
  const totalWeight = sum(Object.values(BOOK_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asBook(target);
    const b = asBook(candidate);
    if (a === undefined || b === undefined) return 0;
    const weighted =
      BOOK_FIELD_WEIGHTS.author * weightedJaccard(a.authors, b.authors, authorIdf) +
      BOOK_FIELD_WEIGHTS.subject * weightedJaccard(a.subjects, b.subjects, subjectIdf) +
      BOOK_FIELD_WEIGHTS.era *
        proximityDecay(a.firstPublishYear, b.firstPublishYear, ERA_HALF_LIFE_YEARS) +
      BOOK_FIELD_WEIGHTS.length * proximityDecay(a.numberOfPages, b.numberOfPages, PAGE_HALF_LIFE);
    return weighted / totalWeight;
  };
};

// TV field weights: two episodes of the same series are the comparison a
// member actually wants when scoring one — the show they are watching is the
// yardstick — so shared series identity outweighs every other signal.
const TV_FIELD_WEIGHTS = {
  series: 6,
  creator: 3,
  cast: 2,
  genre: 2,
  network: 1,
  era: 1,
} as const;

const makeTvSimilarity = (
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer => {
  const creatorIdf = buildIdf(corpus, (d) => asTv(d)?.creators ?? []);
  const castIdf = buildIdf(corpus, (d) => asTv(d)?.castNames ?? []);
  const genreIdf = buildIdf(corpus, (d) => asTv(d)?.genres ?? []);
  const networkIdf = buildIdf(corpus, (d) => asTv(d)?.networks ?? []);
  const totalWeight = sum(Object.values(TV_FIELD_WEIGHTS));

  return (target, candidate) => {
    const a = asTv(target);
    const b = asTv(candidate);
    if (a === undefined || b === undefined) return 0;
    const weighted =
      TV_FIELD_WEIGHTS.series * (a.showId === b.showId ? 1 : 0) +
      TV_FIELD_WEIGHTS.creator * weightedJaccard(a.creators, b.creators, creatorIdf) +
      TV_FIELD_WEIGHTS.cast * weightedJaccard(a.castNames, b.castNames, castIdf) +
      TV_FIELD_WEIGHTS.genre * weightedJaccard(a.genres, b.genres, genreIdf) +
      TV_FIELD_WEIGHTS.network * weightedJaccard(a.networks, b.networks, networkIdf) +
      TV_FIELD_WEIGHTS.era * proximityDecay(tvAirYear(a), tvAirYear(b), ERA_HALF_LIFE_YEARS);
    return weighted / totalWeight;
  };
};

function tvAirYear(tv: TvDataSummary): number | undefined {
  const year = hasValue(tv.airDate) ? Number.parseInt(tv.airDate.slice(0, 4), 10) : Number.NaN;
  return Number.isFinite(year) ? year : undefined;
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
    pluralLabel: "Movies",
    noun: "movie",
    searchHint: "Search for a movie to add.",
    searchableFieldsHint: "title, genre, company, director, actor, or release year",
    filterOptions: [
      enumOption("genre", "Genre", "Select a genre", (data) => asMovie(data)?.genres ?? []),
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
        // Bulk payloads carry names only (castNames); full actor objects are
        // fetched per-work by the detail drawer.
        (data) => asMovie(data)?.castNames ?? [],
      ),
      reviewDateOption,
      yearOption("release_date", "Release Year", "Enter a year", (work) => {
        const movie = asMovie(work.externalData);
        return movie === undefined ? undefined : releaseYear(movie);
      }),
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
    supportsAwards: true,
    invite: {
      shareText: "Join my club and score the movies we watch together.",
    },
    display: movieDisplay,
    isScoredUnit: () => true,
    makeSimilarity: makeMovieSimilarity,
  },
  [ClubType.book]: {
    clubType: ClubType.book,
    workType: WorkType.book,
    icon: "book-open-page-variant-outline",
    label: "Book club",
    pluralLabel: "Books",
    noun: "book",
    searchHint: "Search for a book to add.",
    searchableFieldsHint: "title, author, subject, or published year",
    filterOptions: [
      enumOption("author", "Author", "Select an author", (data) => asBook(data)?.authors ?? []),
      enumOption("subject", "Subject", "Select a subject", (data) => asBook(data)?.subjects ?? []),
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
    supportsAwards: false,
    invite: {
      shareText: "Join my club and score the books we read together.",
    },
    display: bookDisplay,
    isScoredUnit: () => true,
    makeSimilarity: makeBookSimilarity,
  },
  [ClubType.tv]: {
    clubType: ClubType.tv,
    workType: WorkType.tv,
    icon: "television-classic",
    label: "TV club",
    pluralLabel: "TV shows",
    // The unit a TV club scores is the episode. A club adds a show and works
    // down into it, so the add-prompt copy lives in `searchHint` instead.
    noun: "episode",
    searchHint: "Search for a show to add.",
    searchableFieldsHint: "title, genre, creator, network, actor, or air year",
    filterOptions: [
      enumOption("show", "Show", "Select a show", (data) => {
        const tv = asTv(data);
        return tv === undefined ? [] : [tv.showTitle];
      }),
      enumOption("genre", "Genre", "Select a genre", (data) => asTv(data)?.genres ?? []),
      averageScoreOption,
      enumOption("creator", "Creator", "Select a creator", (data) => asTv(data)?.creators ?? []),
      enumOption("network", "Network", "Select a network", (data) => asTv(data)?.networks ?? []),
      enumOption("actor", "Actor", "Select an actor", (data) => asTv(data)?.castNames ?? []),
      reviewDateOption,
      yearOption("air_date", "Air Year", "Enter a year", (work) => {
        const tv = asTv(work.externalData);
        return tv === undefined ? undefined : tvAirYear(tv);
      }),
      numberOption(
        "season_number",
        "Season",
        "Enter a season number",
        (work) => asTv(work.externalData)?.seasonNumber,
      ),
      numberOption(
        "runtime",
        "Runtime (min)",
        "Enter minutes",
        (work) => asTv(work.externalData)?.runtime,
      ),
    ],
    search: searchTvShows,
    stats: {
      pluralNoun: "Episodes",
      countLabel: "episodes watched",
      countIcon: "television-play",
      shareTitle: "TV Club Statistics",
    },
    supportsAwards: false,
    invite: {
      shareText: "Join my club and score the shows we watch together.",
    },
    display: tvDisplay,
    isScoredUnit: (data) => asTv(data)?.level === "episode",
    makeSimilarity: makeTvSimilarity,
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

/**
 * The one-line club summary every club surface shows under the club's name:
 * "Movie club · 6 members". Either half may still be loading, so both are
 * optional and the line degrades to whichever half has arrived.
 */
export function clubMetaLine(type: ClubType | undefined, memberCount: number | undefined): string {
  if (!isDefined(type)) return "";
  const label = clubTypeLabel(type);
  if (!isDefined(memberCount)) return label;
  return `${label} · ${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}

/** Every club type a club can be created as, in registry order. */
export function clubTypeOptions(): ClubTypeConfig[] {
  return Object.values(CLUB_TYPE_CONFIG);
}

/** Statistics-feature copy and icons for a club's media type. */
export function clubTypeStats(type: ClubType): StatsConfig {
  return clubTypeConfig(type).stats;
}

/** Whether a club's media type can use the awards feature. */
export function clubTypeSupportsAwards(type: ClubType): boolean {
  return clubTypeConfig(type).supportsAwards;
}

/** Invite-screen copy for a club's media type. */
export function clubTypeInvite(type: ClubType): InviteConfig {
  return clubTypeConfig(type).invite;
}

// A work self-identifies its media type via `externalData.kind`, so display
// helpers can route to the right registry entry without their callers knowing
// the club type. Both maps are exhaustive (a new type won't compile until added).
const CLUB_TYPE_BY_KIND: Record<WorkDataSummary["kind"], ClubType> = {
  movie: ClubType.movie,
  book: ClubType.book,
  tv: ClubType.tv,
};

const CLUB_TYPE_BY_WORK_TYPE: Record<WorkType, ClubType> = {
  [WorkType.movie]: ClubType.movie,
  [WorkType.book]: ClubType.book,
  [WorkType.tv]: ClubType.tv,
};

function workDisplay(data: WorkDataSummary | undefined): WorkDisplay | undefined {
  if (data === undefined) return undefined;
  // Legacy/partially-cached works can arrive without a `kind` discriminant, so
  // guard the lookup rather than assume it resolves (returns undefined copy,
  // matching the pre-registry asMovie/asBook fallthrough).
  const type = CLUB_TYPE_BY_KIND[data.kind];
  return isDefined(type) ? clubTypeConfig(type).display : undefined;
}

/** A short, media-appropriate subtitle (release/first-published year). */
export function workSubtitle(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.subtitle(data);
}

/**
 * A one-line, media-appropriate summary for the details drawers: "2h 35m ·
 * Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages" (books).
 */
export function workMetaLine(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.metaLine(data);
}

/** The long-form blurb (TMDB overview / book description). */
export function workOverview(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.overview(data);
}

/** What this one work is called, when its media has more than one level. */
export function workNoun(data: WorkDataSummary | undefined): string | undefined {
  return workDisplay(data)?.noun?.(data);
}

/** Whether statistics and review facts count this work (see `isScoredUnit`). */
export function isScoredUnit(work: { type: WorkType; externalData?: WorkDataSummary }): boolean {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[work.type]).isScoredUnit(work.externalData);
}

/**
 * Build a similarity scorer for a work type, calibrated to a candidate pool so
 * tag overlaps are IDF-weighted against that catalogue. Score Assist builds one
 * scorer per session and reuses it across every pivot comparison.
 */
export function makeWorkSimilarity(
  type: WorkType,
  corpus: readonly (WorkDataSummary | undefined)[],
): WorkSimilarityScorer {
  return clubTypeConfig(CLUB_TYPE_BY_WORK_TYPE[type]).makeSimilarity(corpus);
}

/**
 * A single similarity comparison with no catalogue context (every tag weighs
 * equally). Convenience for one-off callers and tests; Score Assist itself uses
 * {@link makeWorkSimilarity} so overlaps are IDF-weighted by the club's works.
 */
export function workSimilarity(
  type: WorkType,
  target: WorkDataSummary | undefined,
  candidate: WorkDataSummary | undefined,
): number {
  return makeWorkSimilarity(type, [])(target, candidate);
}
