import { hasValue } from "./checks/checks.js";
import { GoogleBooksVolume } from "./types/book";

/**
 * Pure matching helpers for the OpenLibrary → Google Books data migration:
 * given a cached title/author, decide which Google Books search candidate (if
 * any) is the same book.
 */

const LEADING_ARTICLES = /^(the|a|an)\s+/;

/**
 * Normalize a title for comparison: lowercase, strip diacritics, punctuation,
 * and leading articles, collapse whitespace.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

/**
 * Titles match when equal or when one is a prefix of the other — Google and
 * OpenLibrary disagree on whether subtitles belong in the title.
 */
export function titlesMatch(a: string, b: string): boolean {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (normA.length === 0 || normB.length === 0) return false;
  return normA.startsWith(normB) || normB.startsWith(normA);
}

function surname(name: string): string {
  const parts = normalizeTitle(name).split(" ");
  return parts[parts.length - 1] ?? "";
}

/** True when any candidate author shares a surname with the target author. */
export function authorsMatch(
  candidateAuthors: string[],
  targetAuthor: string,
): boolean {
  const target = surname(targetAuthor);
  if (target.length === 0) return false;
  return candidateAuthors.some((author) => surname(author) === target);
}

/**
 * Pick the best acceptable candidate for a book, or undefined when none is
 * trustworthy. Acceptance requires a title match and — when the author is
 * known — an author surname match. Among acceptable candidates prefer exact
 * title, then having a cover, then having a page count, then original
 * (relevance) order.
 */
export function selectBestVolume(
  candidates: GoogleBooksVolume[],
  targetTitle: string,
  targetAuthor: string | undefined,
): GoogleBooksVolume | undefined {
  const acceptable = candidates.filter((candidate) => {
    const info = candidate.volumeInfo;
    if (!hasValue(info?.title)) return false;
    const fullTitle = hasValue(info.subtitle)
      ? `${info.title}: ${info.subtitle}`
      : info.title;
    const titleOk =
      titlesMatch(info.title, targetTitle) ||
      titlesMatch(fullTitle, targetTitle);
    if (!titleOk) return false;
    if (!hasValue(targetAuthor)) return true;
    return authorsMatch(info.authors ?? [], targetAuthor);
  });

  const score = (candidate: GoogleBooksVolume): number => {
    const info = candidate.volumeInfo;
    let value = 0;
    if (
      hasValue(info?.title) &&
      normalizeTitle(info.title) === normalizeTitle(targetTitle)
    ) {
      value += 4;
    }
    if (info?.imageLinks !== undefined) value += 2;
    if (info?.pageCount !== undefined) value += 1;
    return value;
  };

  // Stable sort keeps relevance order among equal scores.
  return [...acceptable].sort((a, b) => score(b) - score(a))[0];
}
