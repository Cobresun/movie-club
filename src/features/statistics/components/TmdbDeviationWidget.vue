<template>
  <WidgetShell v-if="hasData" title="Club vs TMDB" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <div class="space-y-2">
      <div
        v-for="entry in activeEntries"
        :key="entry.title"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
      >
        <img
          v-if="entry.imageUrl"
          :src="entry.imageUrl"
          :alt="entry.title"
          class="h-12 w-8 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>

        <div class="min-w-0 flex-1 text-left">
          <p
            class="truncate text-sm font-medium text-white"
            :title="entry.title"
          >
            {{ entry.title }}
          </p>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <span>Club: {{ entry.clubScore }}</span>
            <span class="text-slate-600">|</span>
            <span>TMDB: {{ entry.tmdbScore }}</span>
          </div>
        </div>

        <span
          class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="
            mode === 'higher'
              ? 'bg-emerald-900/30 text-emerald-400'
              : 'bg-rose-900/30 text-rose-400'
          "
        >
          {{ entry.deviation > 0 ? "+" : "" }}{{ entry.deviation }}
        </span>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { computeTmdbDeviation } from "../statsComputers";
import type { MovieData } from "../types";

type Mode = "higher" | "lower";

const props = defineProps<{
  movieData: MovieData[];
}>();

const deviation = computed(() => computeTmdbDeviation(props.movieData));

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (deviation.value.clubRatedHigher.length > 0) {
    options.push({ value: "higher", label: "We Liked More" });
  }
  if (deviation.value.clubRatedLower.length > 0) {
    options.push({ value: "lower", label: "We Liked Less" });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("higher");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "higher"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const activeEntries = computed(() =>
  mode.value === "higher"
    ? deviation.value.clubRatedHigher
    : deviation.value.clubRatedLower,
);

const subtitle = computed(() =>
  mode.value === "higher"
    ? "Movies your club rated above the TMDB average"
    : "Movies your club rated below the TMDB average",
);
</script>
