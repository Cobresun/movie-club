import { hasValue, isDefined } from "../../../lib/checks/checks";
import { WorkType } from "../../../lib/types/generated/db";

/**
 * What an /add deep link identifies. `imdbId` is exact (resolved via TMDB
 * find); `title`/`year` drive the fallback search when it is absent.
 */
export interface AddLinkTarget {
  workType: WorkType;
  imdbId?: string;
  title?: string;
  year?: string;
}

/** vue-router's LocationQuery shape, without importing vue-router. */
export type AddLinkQuery = Record<
  string,
  string | null | (string | null)[] | undefined
>;

const IMDB_ID_PATTERN = /tt\d{7,10}/;
const YEAR_PATTERN = /\b(?:19|20)\d{2}\b/;
const URL_PATTERN = /https?:\/\/\S+/g;
// Suffixes shared page titles carry: "Inception (2010) - IMDb".
const TITLE_NOISE_PATTERN =
  /\s*[-|–—]\s*(?:IMDb|Rotten Tomatoes|Letterboxd|Wikipedia|Google Search)\s*$/i;
const TRAILING_YEAR_PATTERN = /\(\s*(?:19|20)\d{2}\s*\)\s*$/;

function firstValue(value: AddLinkQuery[string]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = isDefined(raw) ? raw.trim() : undefined;
  return hasValue(trimmed) ? trimmed : undefined;
}

export function extractImdbId(raw: string | undefined): string | undefined {
  if (!hasValue(raw)) return undefined;
  return raw.match(IMDB_ID_PATTERN)?.[0];
}

function cleanTitle(raw: string | undefined): string | undefined {
  if (!hasValue(raw)) return undefined;
  const cleaned = raw
    .replace(URL_PATTERN, " ")
    .replace(TITLE_NOISE_PATTERN, "")
    .replace(TRAILING_YEAR_PATTERN, "")
    .trim();
  return hasValue(cleaned) ? cleaned : undefined;
}

function extractYear(
  ...candidates: (string | undefined)[]
): string | undefined {
  for (const candidate of candidates) {
    const year = hasValue(candidate)
      ? candidate.match(YEAR_PATTERN)?.[0]
      : undefined;
    if (hasValue(year)) return year;
  }
  return undefined;
}

/**
 * Interpret an /add deep link's query params. Accepts the explicit params the
 * browser extension sends (`imdb`, `title`, `year`) as well as the raw
 * `url`/`text`/`title` a Web Share Target or share-sheet shortcut would send,
 * so mobile entry points can reuse this route unchanged.
 */
export function parseAddLinkQuery(query: AddLinkQuery): AddLinkTarget {
  const imdbParam = firstValue(query.imdb);
  const titleParam = firstValue(query.title);
  const yearParam = firstValue(query.year);
  const urlParam = firstValue(query.url);
  const textParam = firstValue(query.text);

  const imdbId =
    extractImdbId(imdbParam) ??
    extractImdbId(urlParam) ??
    extractImdbId(textParam);

  const textWithoutUrls = isDefined(textParam)
    ? textParam.replace(URL_PATTERN, " ")
    : undefined;
  const title = cleanTitle(titleParam) ?? cleanTitle(textWithoutUrls);
  // Years are only trusted outside URLs, so path segments like /2010/ in a
  // shared link can't masquerade as a release year.
  const year = extractYear(yearParam, titleParam, textWithoutUrls);

  return { workType: WorkType.movie, imdbId, title, year };
}
