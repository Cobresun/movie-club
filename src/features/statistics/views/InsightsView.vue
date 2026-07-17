<template>
  <div class="space-y-6 pb-6">
    <component
      :is="widget.component"
      v-for="widget in widgets"
      :key="widget.key"
      v-bind="widget.props"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import { STAT_WIDGETS, type StatWidgetContext } from "../statisticsWidgets";
import {
  isBookStats,
  isMovieStats,
  type HistogramData,
  type WorkStatsData,
} from "../types";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  histogramData: HistogramData[];
  clubType: ClubType;
}>();

// Media-specific widgets read metadata off the narrowed slice: genres/TMDB for
// movies, subjects/authors for books. Era and activity widgets are
// media-agnostic and take workData. Which widgets appear (and in what order)
// is driven by the per-club-type STAT_WIDGETS registry.
const context = computed<StatWidgetContext>(() => ({
  workData: props.workData,
  movieData: props.workData.filter(isMovieStats),
  bookData: props.workData.filter(isBookStats),
  members: props.members,
  histogramData: props.histogramData,
  clubType: props.clubType,
}));

const widgets = computed(() =>
  STAT_WIDGETS[props.clubType]
    .filter((widget) => widget.visible?.(context.value) ?? true)
    .map((widget) => ({
      key: widget.key,
      component: widget.component,
      props: widget.props(context.value),
    })),
);
</script>
