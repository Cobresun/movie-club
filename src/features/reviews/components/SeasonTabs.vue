<template>
  <div
    role="tablist"
    aria-label="Seasons"
    class="flex gap-2 overflow-x-auto py-2.5 pl-3 pr-1 md:pl-11"
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
      :tabindex="season.seasonNumber === selected ? 0 : -1"
      class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-fast ease-standard"
      :class="
        season.seasonNumber === selected
          ? 'bg-primary text-white'
          : 'bg-white/5 text-gray-300 hover:bg-white/10'
      "
      @click="select(index)"
    >
      {{ season.title }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { SeasonNode, seasonPanelId, seasonTabId } from "../reviewTree";

const props = defineProps<{
  showId: string;
  seasons: SeasonNode[];
}>();

const selected = defineModel<number>({ required: true });

const tabs = useTemplateRef<HTMLButtonElement[]>("tabs");

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
