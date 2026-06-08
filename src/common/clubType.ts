import axios from "axios";

import {
  OpenLibrarySearchDoc,
  OpenLibrarySearchResponse,
} from "@/../lib/types/book";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { TMDBPageResponse } from "@/../lib/types/movie";

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
 * Everything that varies by a club's media type, in one place. To add a third
 * club type: add the enum value (migration + codegen) and one entry here — copy,
 * icons, and search all flow from this registry rather than scattered
 * `if (clubType === ...)` branches.
 */
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
  /** Search the club type's external source for works to add. */
  readonly search: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<WorkSearchResult[]>;
}

export const CLUB_TYPE_CONFIG: Record<ClubType, ClubTypeConfig> = {
  [ClubType.movie]: {
    clubType: ClubType.movie,
    workType: WorkType.movie,
    icon: "movie-open-outline",
    label: "Movie club",
    noun: "movie",
    searchHint: "Search for a movie to add.",
    search: searchMovies,
  },
  [ClubType.book]: {
    clubType: ClubType.book,
    workType: WorkType.book,
    icon: "book-open-page-variant-outline",
    label: "Book club",
    noun: "book",
    searchHint: "Search for a book to add.",
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
