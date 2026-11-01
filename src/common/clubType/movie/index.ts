import { clubScoreFilter, decadePresets, reviewedInFilter } from "../filterOptions";
import { type ClubTypeConfig } from "../types";
import { movieDisplay } from "./display";
import { browseMovies, searchMovies } from "./search";
import { makeMovieSimilarity } from "./similarity";
import { releaseYear } from "@/../lib/movie/releaseYear";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { asMovie, formatRuntime } from "@/common/workDisplay";

export const movieClubConfig: ClubTypeConfig = {
  clubType: ClubType.MOVIE,
  workType: WorkType.MOVIE,
  icon: "movie-open-outline",
  label: "Movie club",
  pluralLabel: "Movies",
  noun: "movie",
  finishedVerb: "watched",
  searchHint: "Search for a movie to add.",
  searchableFieldsHint: "title, genre, company, director, actor, or release year",
  filterOptions: [
    {
      kind: "choice",
      key: "genre",
      label: "Genre",
      icon: "drama-masks",
      values: (work) => asMovie(work.externalData)?.genres ?? [],
      searchPlaceholder: "Find a genre",
      order: "popular",
    },
    clubScoreFilter,
    {
      kind: "range",
      key: "release_date",
      label: "Release year",
      icon: "calendar-range",
      value: (work) => {
        const movie = asMovie(work.externalData);
        return movie === undefined ? undefined : releaseYear(movie);
      },
      step: 1,
      bucket: 5,
      format: String,
      presets: decadePresets,
    },
    {
      kind: "range",
      key: "runtime",
      label: "Runtime",
      icon: "timer-outline",
      value: (work) => asMovie(work.externalData)?.runtime,
      step: 5,
      bucket: 15,
      format: formatRuntime,
      presets: () => [
        { label: "Short & sweet", detail: "under 1h 30m", to: 90 },
        { label: "Feature length", detail: "1h 30m – 2h", from: 90, to: 120 },
        { label: "Epic", detail: "2h 30m+", from: 150 },
      ],
    },
    {
      kind: "choice",
      key: "director",
      label: "Director",
      icon: "bullhorn-outline",
      values: (work) => asMovie(work.externalData)?.directors?.map((d) => d.name) ?? [],
      searchPlaceholder: "Find a director",
      order: "popular",
    },
    {
      kind: "choice",
      key: "actor",
      label: "Cast",
      icon: "account-star",
      // Bulk payloads carry names only (castNames); full actor objects are
      // fetched per-work by the detail drawer.
      values: (work) => asMovie(work.externalData)?.castNames ?? [],
      searchPlaceholder: "Find an actor",
      order: "popular",
    },
    {
      kind: "choice",
      key: "company",
      label: "Studio",
      icon: "domain",
      values: (work) => asMovie(work.externalData)?.production_companies ?? [],
      searchPlaceholder: "Find a studio",
      order: "popular",
    },
    reviewedInFilter,
  ],
  search: searchMovies,
  browseTabs: [
    { key: "popular", label: "Popular" },
    { key: "now_playing", label: "Now Playing" },
    { key: "upcoming", label: "Upcoming" },
    { key: "top_rated", label: "Top Rated" },
  ],
  browse: browseMovies,
  stats: {
    pluralNoun: "Movies",
    countLabel: "movies watched",
    countIcon: "filmstrip",
    shareTitle: "Movie Club Statistics",
  },
  supportsAwards: true,
  supportsWatchProviders: true,
  supportsRecommendations: true,
  invite: {
    shareText: "Join my club and score the movies we watch together.",
  },
  display: movieDisplay,
  isScoredUnit: () => true,
  makeSimilarity: makeMovieSimilarity,
};
