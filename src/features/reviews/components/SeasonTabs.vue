<template>
  <div
    role="tablist"
    aria-label="Seasons"
    class="flex gap-2 overflow-x-auto px-3 pb-1 pt-3 md:pl-11 md:pr-3"
    @keydown="onKeydown"
  >
    <button
      v-for="(season, index) in seasons"
      :id="seasonTabId(showId, season.seasonNumber)"
      :key="season.seasonNumber"
      ref="tabs"
      type="button"
      role="tab"
      :aria-selected="season.seasonNumber === selected"
      :aria-controls="seasonPanelId(showId, season.seasonNumber)"
      :aria-label="tabLabel(season)"
      :tabindex="season.seasonNumber === selected ? 0 : -1"
      class="relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full py-1.5 pl-3.5 pr-3 text-sm font-semibold transition duration-fast ease-standard"
      :class="
        season.seasonNumber === selected
          ? 'bg-primary text-white shadow-md shadow-primary/25'
          : 'bg-white/5 text-gray-300 hover:bg-white/10'
      "
      @click="select(index)"
    >
      <span>S{{ season.seasonNumber }}</span>
      <span
        v-if="isRevealed(season) && isDefined(season.scores.average)"
        class="font-bold"
        :class="season.seasonNumber === selected ? 'text-white/85' : 'text-primary'"
        aria-hidden="true"
      >
        {{ formatRollup(season.scores) }}
      </span>
      <mdicon
        v-if="isComplete(season)"
        name="check-circle"
        :size="16"
        :class="season.seasonNumber === selected ? 'text-white' : 'text-primary'"
        aria-hidden="true"
      />
      <!-- How far through the season the club is, as a hairline along the
           pill's bottom edge. -->
      <span
        class="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
        :class="season.seasonNumber === selected ? 'bg-white/25' : 'bg-white/10'"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-full"
          :class="season.seasonNumber === selected ? 'bg-white' : 'bg-primary'"
          :style="{ width: `${coveragePercent(season.scoredCount, season.episodeCount)}%` }"
        />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import {
  coveragePercent,
  formatRollup,
  rollupLabel,
  SeasonNode,
  seasonPanelId,
  seasonTabId,
} from "../reviewTree";

const props = defineProps<{
  showId: string;
  seasons: SeasonNode[];
  /** Whether the reader may see a season's average yet. */
  isRevealed: (season: SeasonNode) => boolean;
}>();

const selected = defineModel<number>({ required: true });

const tabs = useTemplateRef<HTMLButtonElement[]>("tabs");

const isComplete = (season: SeasonNode) =>
  season.episodeCount > 0 && season.scoredCount >= season.episodeCount;

// A hidden average stays out of the accessible name too, rather than being
// read out from under a blur.
const tabLabel = (season: SeasonNode) =>
  props.isRevealed(season) ? `${season.title}, ${rollupLabel(season.scores)}` : season.title;

const select = (index: number) => {
  const season = props.seasons[index];
  if (isDefined(season)) selected.value = season.seasonNumber;
};

// Arrow keys move between seasons, as in any tab list; Home and End jump to
// either end.
const onKeydown = (event: KeyboardEvent) => {
  const current = props.seasons.findIndex((season) => season.seasonNumber === selected.value);
  const last = props.seasons.length - 1;
  const targets: Record<string, number | undefined> = {
    ArrowRight: Math.min(current + 1, last),
    ArrowLeft: Math.max(current - 1, 0),
    Home: 0,
    End: last,
  };
  const next = targets[event.key];
  if (!isDefined(next)) return;
  event.preventDefault();
  select(next);
  tabs.value?.[next]?.focus();
};
</script>
