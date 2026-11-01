import { clubScoreFilter, reviewedInFilter } from "../filterOptions";
import { type ClubTypeConfig } from "../types";
import { bookDisplay } from "./display";
import { browseBooks, searchBooks } from "./search";
import { makeBookSimilarity } from "./similarity";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { asBook } from "@/common/workDisplay";

export const bookClubConfig: ClubTypeConfig = {
  clubType: ClubType.BOOK,
  workType: WorkType.BOOK,
  icon: "book-open-page-variant-outline",
  label: "Book club",
  pluralLabel: "Books",
  noun: "book",
  finishedVerb: "read",
  searchHint: "Search for a book to add.",
  searchableFieldsHint: "title, author, subject, or published year",
  filterOptions: [
    {
      kind: "choice",
      key: "author",
      label: "Author",
      icon: "feather",
      values: (work) => asBook(work.externalData)?.authors ?? [],
      searchPlaceholder: "Find an author",
      order: "popular",
    },
    {
      kind: "choice",
      key: "subject",
      label: "Subject",
      icon: "tag-outline",
      values: (work) => asBook(work.externalData)?.subjects ?? [],
      searchPlaceholder: "Find a subject",
      order: "popular",
    },
    clubScoreFilter,
    {
      kind: "range",
      key: "first_publish_year",
      label: "First published",
      icon: "calendar-range",
      value: (work) => asBook(work.externalData)?.firstPublishYear,
      step: 1,
      bucket: 10,
      format: String,
      presets: () => [
        { label: "Classics", detail: "before 1950", to: 1949 },
        { label: "Modern", detail: "1950 – 1999", from: 1950, to: 1999 },
        { label: "This century", detail: "2000+", from: 2000 },
      ],
    },
    {
      kind: "range",
      key: "pages",
      label: "Length",
      icon: "book-open-page-variant-outline",
      value: (work) => asBook(work.externalData)?.numberOfPages,
      step: 10,
      bucket: 50,
      format: (pages) => `${pages} pages`,
      presets: () => [
        { label: "Quick read", detail: "under 200 pages", to: 200 },
        { label: "Doorstopper", detail: "500+ pages", from: 500 },
      ],
    },
    reviewedInFilter,
  ],
  search: searchBooks,
  browseTabs: [
    { key: "fiction", label: "Fiction" },
    { key: "mystery", label: "Mystery" },
    { key: "science fiction", label: "Sci-Fi" },
    { key: "biography", label: "Biography" },
    { key: "history", label: "History" },
  ],
  browse: browseBooks,
  stats: {
    pluralNoun: "Books",
    countLabel: "books read",
    countIcon: "book-open-page-variant-outline",
    shareTitle: "Book Club Statistics",
  },
  supportsAwards: false,
  supportsWatchProviders: false,
  supportsRecommendations: false,
  invite: {
    shareText: "Join my club and score the books we read together.",
  },
  display: bookDisplay,
  isScoredUnit: () => true,
  makeSimilarity: makeBookSimilarity,
};
