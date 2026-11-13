import { clubScoreFilter, decadePresets, reviewedInFilter } from "../filterOptions";
import { type ClubTypeConfig } from "../types";
import { movieDisplay } from "./display";
import { movieLandingPreview } from "./landingPreview";
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
  dailyGame: {
    name: "Reelated",
    path: "/reelated",
    tagline: "One mystery movie a day. Every guess tells you how related it is. No account needed.",
    similarityRule:
      "Each clue under a guess is worth points, and the points add up to its rank. A shared director is worth 10, each shared star 5, a shared studio 2 (the big ones don't count), and a shared genre, language or decade 1 to 4, the rarer the more. Each genre the guess has that the answer doesn't costs 1. A guess from another decade says whether the answer is older or newer. When two guesses tie, the one released nearer the answer ranks higher.",
    preview: {
      poolSize: 3000,
      guesses: [
        {
          id: "329865",
          title: "Arrival",
          year: 2016,
          rank: 2,
          clues: [
            { text: "Same director: Denis Villeneuve", points: 10 },
            { text: "Drama", points: 2 },
            { text: "Science Fiction", points: 2 },
            { text: "Also from the 2010s", points: 1 },
            { text: "Not Mystery", points: -1 },
          ],
        },
        {
          id: "273481",
          title: "Sicario",
          year: 2015,
          rank: 8,
          clues: [
            { text: "Same director: Denis Villeneuve", points: 10 },
            { text: "Also from the 2010s", points: 1 },
            { text: "Not Action, Crime, Thriller", points: -3 },
          ],
        },
        {
          id: "152601",
          title: "Her",
          year: 2013,
          rank: 76,
          clues: [
            { text: "Science Fiction", points: 2 },
            { text: "Drama", points: 2 },
            { text: "Also from the 2010s", points: 1 },
            { text: "Not Romance", points: -1 },
          ],
        },
        {
          id: "578",
          title: "Jaws",
          year: 1975,
          rank: 2808,
          clues: [
            { text: "Answer is from after the 1970s", points: 0 },
            { text: "Not Horror, Thriller, Adventure", points: -3 },
          ],
        },
      ],
    },
  },
  landingPreview: movieLandingPreview,
};
