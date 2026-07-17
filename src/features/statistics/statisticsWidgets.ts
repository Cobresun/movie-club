import { type Component } from "vue";

import ActivityWidget from "./components/ActivityWidget.vue";
import AuthorLeaderboardWidget from "./components/AuthorLeaderboardWidget.vue";
import ClubConsensusWidget from "./components/ClubConsensusWidget.vue";
import ClubRecordsWidget from "./components/ClubRecordsWidget.vue";
import EraWidget from "./components/EraWidget.vue";
import GenresWidget from "./components/GenresWidget.vue";
import MemberOutliersWidget from "./components/MemberOutliersWidget.vue";
import PeopleWidget from "./components/PeopleWidget.vue";
import ReviewerLeaderboardWidget from "./components/ReviewerLeaderboardWidget.vue";
import ScoreChartsWidget from "./components/ScoreChartsWidget.vue";
import StatsWidget from "./components/StatsWidget.vue";
import SubjectStatsWidget from "./components/SubjectStatsWidget.vue";
import TasteSimilarityWidget from "./components/TasteSimilarityWidget.vue";
import TmdbDeviationWidget from "./components/TmdbDeviationWidget.vue";
import {
  type BookData,
  type HistogramData,
  type MovieData,
  type WorkStatsData,
} from "./types";
import { Member } from "../../../lib/types/club.js";
import { ClubType } from "../../../lib/types/generated/db";

/**
 * Everything a statistics widget might need, assembled once by InsightsView and
 * handed to each widget's `props` builder. `movieData` / `bookData` are the
 * club-type-narrowed slices; widgets that only apply to one media type read
 * from those (see {@link STAT_WIDGETS}).
 */
export interface StatWidgetContext {
  workData: WorkStatsData[];
  movieData: MovieData[];
  bookData: BookData[];
  members: Member[];
  histogramData: HistogramData[];
  clubType: ClubType;
}

/**
 * A single widget slot on the statistics page. `props` derives the widget's
 * props from the shared context; the optional `visible` gate handles data-driven
 * conditions (e.g. member count) that club type alone doesn't capture.
 */
export interface StatWidgetDef {
  /** Stable key for the `v-for` render. */
  key: string;
  component: Component;
  props: (ctx: StatWidgetContext) => Record<string, unknown>;
  visible?: (ctx: StatWidgetContext) => boolean;
}

/** Comparison stats only make sense once the club has enough members. */
const hasMoreThan =
  (count: number) =>
  (ctx: StatWidgetContext): boolean =>
    ctx.members.length > count;

// Widgets shared by every club type, in page order. Kept as builders so each
// club-type list can interleave its media-specific widgets between them.
const statsWidget: StatWidgetDef = {
  key: "stats",
  component: StatsWidget,
  props: (ctx) => ({ workData: ctx.workData, clubType: ctx.clubType }),
};
const clubRecordsWidget: StatWidgetDef = {
  key: "club-records",
  component: ClubRecordsWidget,
  props: (ctx) => ({ workData: ctx.workData }),
};
const scoreChartsWidget: StatWidgetDef = {
  key: "score-charts",
  component: ScoreChartsWidget,
  props: (ctx) => ({
    workData: ctx.workData,
    members: ctx.members,
    histogramData: ctx.histogramData,
  }),
};
const activityWidget: StatWidgetDef = {
  key: "activity",
  component: ActivityWidget,
  props: (ctx) => ({ workData: ctx.workData, clubType: ctx.clubType }),
};
const eraWidget: StatWidgetDef = {
  key: "era",
  component: EraWidget,
  props: (ctx) => ({
    workData: ctx.workData,
    members: ctx.members,
    clubType: ctx.clubType,
  }),
};
const reviewerLeaderboardWidget: StatWidgetDef = {
  key: "reviewer-leaderboard",
  component: ReviewerLeaderboardWidget,
  props: (ctx) => ({ workData: ctx.workData, members: ctx.members }),
  visible: hasMoreThan(1),
};
const tasteSimilarityWidget: StatWidgetDef = {
  key: "taste-similarity",
  component: TasteSimilarityWidget,
  props: (ctx) => ({ workData: ctx.workData, members: ctx.members }),
  visible: hasMoreThan(2),
};
const memberOutliersWidget: StatWidgetDef = {
  key: "member-outliers",
  component: MemberOutliersWidget,
  props: (ctx) => ({
    workData: ctx.workData,
    members: ctx.members,
    clubType: ctx.clubType,
  }),
  visible: hasMoreThan(1),
};
const clubConsensusWidget: StatWidgetDef = {
  key: "club-consensus",
  component: ClubConsensusWidget,
  props: (ctx) => ({ workData: ctx.workData, members: ctx.members }),
};

/**
 * The ordered widget list per club type. Adding a club type means adding one
 * entry here (and filling any media-specific slots) rather than sprinkling
 * `v-if="isMovieClub"` branches through InsightsView. Feature-local — it wires
 * up statistics components, so it must not live in `src/common/clubType.ts`
 * (that would invert the common → feature dependency; see code-quality.md).
 */
export const STAT_WIDGETS: Record<ClubType, StatWidgetDef[]> = {
  [ClubType.movie]: [
    statsWidget,
    clubRecordsWidget,
    scoreChartsWidget,
    activityWidget,
    {
      key: "genres",
      component: GenresWidget,
      props: (ctx) => ({ movieData: ctx.movieData, members: ctx.members }),
    },
    eraWidget,
    {
      key: "people",
      component: PeopleWidget,
      props: (ctx) => ({ movieData: ctx.movieData }),
    },
    reviewerLeaderboardWidget,
    tasteSimilarityWidget,
    memberOutliersWidget,
    clubConsensusWidget,
    {
      key: "tmdb-deviation",
      component: TmdbDeviationWidget,
      props: (ctx) => ({ movieData: ctx.movieData }),
    },
  ],
  [ClubType.book]: [
    statsWidget,
    clubRecordsWidget,
    scoreChartsWidget,
    activityWidget,
    {
      key: "subjects",
      component: SubjectStatsWidget,
      props: (ctx) => ({ bookData: ctx.bookData }),
    },
    eraWidget,
    {
      key: "authors",
      component: AuthorLeaderboardWidget,
      props: (ctx) => ({ bookData: ctx.bookData }),
    },
    reviewerLeaderboardWidget,
    tasteSimilarityWidget,
    memberOutliersWidget,
    clubConsensusWidget,
  ],
};
