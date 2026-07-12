<template>
  <WidgetShell
    v-if="hasData"
    title="Filmmakers"
    subtitle="Ranked by appearances in your club's reviews"
  >
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <PersonLeaderboard
      :entries="activeEntries"
      :empty-message="`No ${mode} data available yet.`"
    />
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import PersonLeaderboard from "./PersonLeaderboard.vue";
import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { computeTopActors, computeTopDirectors } from "../statsComputers";
import type { MovieData } from "../types";

type Mode = "directors" | "actors";

const props = defineProps<{
  movieData: MovieData[];
}>();

const topDirectors = computed(() => computeTopDirectors(props.movieData));
const topActors = computed(() => computeTopActors(props.movieData));

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (topDirectors.value.length > 0) {
    options.push({ value: "directors", label: "Directors" });
  }
  if (topActors.value.length > 0) {
    options.push({ value: "actors", label: "Actors" });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("directors");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "directors"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const activeEntries = computed(() =>
  mode.value === "directors" ? topDirectors.value : topActors.value,
);
</script>
