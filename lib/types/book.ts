/**
 * Book metadata, sourced from Google Books. The `kind` discriminant mirrors
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

// --- Google Books API response shapes ---------------------------------------

/** Cover images for a volume. URLs are http:// and may carry `edge=curl`. */
export interface GoogleBooksImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
}

export interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  /** May contain HTML markup (`<p>`, `<br>`, `<b>`, …). */
  description?: string;
  /** "YYYY" | "YYYY-MM" | "YYYY-MM-DD" */
  publishedDate?: string;
  pageCount?: number;
  /** BISAC category paths, e.g. "Fiction / Thrillers / Suspense". */
  categories?: string[];
  /** Mean user rating (1–5). Absent on most volumes. */
  averageRating?: number;
  /** Number of user ratings — the closest thing the API has to popularity. */
  ratingsCount?: number;
  imageLinks?: GoogleBooksImageLinks;
  industryIdentifiers?: { type: string; identifier: string }[];
}

/** A volume from https://www.googleapis.com/books/v1/volumes */
export interface GoogleBooksVolume {
  id: string;
  volumeInfo?: GoogleBooksVolumeInfo;
}

/** Response from /volumes search. `items` is absent (not []) on no results. */
export interface GoogleBooksSearchResponse {
  totalItems: number;
  items?: GoogleBooksVolume[];
}
