import { clubScoreFilter, decadePresets, reviewedInFilter } from "../filterOptions";
import { type ClubTypeConfig } from "../types";
import { asTv, tvAirYear } from "./data";
import { tvDisplay } from "./display";
import { browseTvShows, searchTvShows } from "./search";
import { makeTvSimilarity } from "./similarity";
import { ClubType, WorkType } from "@/../lib/types/generated/db";
import { formatRuntime } from "@/common/workDisplay";

export const tvClubConfig: ClubTypeConfig = {
  clubType: ClubType.TV,
  workType: WorkType.TV,
  icon: "television-classic",
  label: "TV club",
  pluralLabel: "TV shows",
  // The unit a TV club scores is the episode. A club adds a show and works
  // down into it, so the add-prompt copy lives in `searchHint` instead.
  noun: "episode",
  finishedVerb: "watched",
  searchHint: "Search for a show to add.",
  searchableFieldsHint: "title, genre, creator, network, actor, or air year",
  filterOptions: [
    {
      kind: "choice",
      key: "show",
      label: "Show",
      icon: "television-classic",
      values: (work) => {
        const tv = asTv(work.externalData);
        return tv === undefined ? [] : [tv.showTitle];
      },
      searchPlaceholder: "Find a show",
      order: "popular",
    },
    {
      kind: "choice",
      key: "genre",
      label: "Genre",
      icon: "drama-masks",
      values: (work) => asTv(work.externalData)?.genres ?? [],
      searchPlaceholder: "Find a genre",
      order: "popular",
    },
    clubScoreFilter,
    {
      kind: "range",
      key: "air_date",
      label: "Air year",
      icon: "calendar-range",
      value: (work) => {
        const tv = asTv(work.externalData);
        return tv === undefined ? undefined : tvAirYear(tv);
      },
      step: 1,
      bucket: 5,
      format: String,
      presets: decadePresets,
    },
    {
      kind: "range",
      key: "season_number",
      label: "Season",
      icon: "television-play",
      value: (work) => asTv(work.externalData)?.seasonNumber,
      step: 1,
      bucket: 1,
      format: (season) => `Season ${season}`,
      presets: () => [],
    },
    {
      kind: "range",
      key: "runtime",
      label: "Runtime",
      icon: "timer-outline",
      value: (work) => asTv(work.externalData)?.runtime,
      step: 5,
      bucket: 15,
      format: formatRuntime,
      presets: () => [
        { label: "Half hour", detail: "under 35m", to: 35 },
        { label: "Hour long", detail: "45m+", from: 45 },
      ],
    },
    {
      kind: "choice",
      key: "creator",
      label: "Creator",
      icon: "bullhorn-outline",
      values: (work) => asTv(work.externalData)?.creators ?? [],
      searchPlaceholder: "Find a creator",
      order: "popular",
    },
    {
      kind: "choice",
      key: "actor",
      label: "Cast",
      icon: "account-star",
      values: (work) => asTv(work.externalData)?.castNames ?? [],
      searchPlaceholder: "Find an actor",
      order: "popular",
    },
    {
      kind: "choice",
      key: "network",
      label: "Network",
      icon: "domain",
      values: (work) => asTv(work.externalData)?.networks ?? [],
      searchPlaceholder: "Find a network",
      order: "popular",
    },
    reviewedInFilter,
  ],
  search: searchTvShows,
  browseTabs: [
    { key: "popular", label: "Popular" },
    { key: "on_the_air", label: "On the Air" },
    { key: "top_rated", label: "Top Rated" },
  ],
  browse: browseTvShows,
  stats: {
    pluralNoun: "Episodes",
    countLabel: "episodes watched",
    countIcon: "television-play",
    shareTitle: "TV Club Statistics",
  },
  supportsAwards: false,
  // Where-to-watch only queries TMDB's movie endpoint; a show id there would
  // resolve to an unrelated movie.
  supportsWatchProviders: false,
  // Recommendations come from TMDB's movie recommendations endpoint only.
  supportsRecommendations: false,
  invite: {
    shareText: "Join my club and score the shows we watch together.",
  },
  display: tvDisplay,
  isScoredUnit: (data) => asTv(data)?.level === "episode",
  makeSimilarity: makeTvSimilarity,
  dailyGame: undefined,
};
