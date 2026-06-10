/**
 * Book metadata, sourced from OpenLibrary. The `kind` discriminant mirrors
 * `DetailedMovieData.kind` so `DetailedWorkData` is a proper discriminated
 * union and UI components can narrow on `externalData.kind`.
 */
export interface DetailedBookData {
  kind: "book";
  title: string;
  description?: string;
  authors: string[];
  subjects: string[];
  firstPublishYear?: number;
  numberOfPages?: number;
  coverUrl?: string;
}

// --- OpenLibrary API response shapes ---------------------------------------

/** A single result from https://openlibrary.org/search.json */
export interface OpenLibrarySearchDoc {
  key: string; // e.g. "/works/OL45804W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibrarySearchDoc[];
}

/** Response from https://openlibrary.org/trending/{period}.json */
export interface OpenLibraryTrendingResponse {
  works: OpenLibrarySearchDoc[];
}

/** A work document from https://openlibrary.org/works/{OLID}.json */
export interface OpenLibraryWork {
  title?: string;
  description?: string | { value: string };
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
  authors?: { author: { key: string } }[];
}

export interface OpenLibraryAuthor {
  name?: string;
}

/** An edition from https://openlibrary.org/works/{OLID}/editions.json */
export interface OpenLibraryEdition {
  publish_date?: string;
  number_of_pages?: number;
}

export interface OpenLibraryEditionsResponse {
  entries: OpenLibraryEdition[];
}
