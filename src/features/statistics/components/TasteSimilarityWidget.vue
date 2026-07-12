<template>
  <WidgetShell v-if="hasData" title="Taste Similarity" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <div v-if="activePair" class="text-left">
      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar
            :src="activePair.memberA.image"
            :name="activePair.memberA.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(activePair.memberA.name)
          }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold" :class="accentTextClass"
            >{{ activePair.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar
            :src="activePair.memberB.image"
            :name="activePair.memberB.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(activePair.memberB.name)
          }}</span>
        </div>
      </div>

      <div
        class="mb-3 rounded px-3 py-2 text-sm text-slate-300"
        :class="mode === 'most' ? 'bg-emerald-900/20' : 'bg-rose-900/20'"
      >
        Average score difference:
        <span class="font-semibold" :class="accentTextClass">{{
          activePair.avgDifference
        }}</span>
        points across {{ activePair.sharedCount }} shared reviews
      </div>

      <div v-if="highlightMovies.length > 0">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          {{ mode === "most" ? "Top agreements" : "Biggest disagreements" }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in highlightMovies"
            :key="movie.title"
            class="flex items-center justify-between text-sm"
          >
            <span class="truncate text-slate-300" :title="movie.title">{{
              movie.title
            }}</span>
            <span class="ml-2 shrink-0 text-xs text-slate-400">
              {{ movie.scoreA }} vs {{ movie.scoreB }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { computeTasteSimilarity } from "../statsComputers";
import type { WorkStatsData } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

type Mode = "most" | "least";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
}>();

const tasteSimilarity = computed(() =>
  computeTasteSimilarity(props.workData, props.members),
);

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (isDefined(tasteSimilarity.value.mostSimilar)) {
    options.push({ value: "most", label: "Most Similar" });
  }
  if (isDefined(tasteSimilarity.value.leastSimilar)) {
    options.push({ value: "least", label: "Least Similar" });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("most");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "most"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const activePair = computed(() =>
  mode.value === "most"
    ? tasteSimilarity.value.mostSimilar
    : tasteSimilarity.value.leastSimilar,
);

const highlightMovies = computed(() => {
  if (!isDefined(activePair.value)) return [];
  return mode.value === "most"
    ? activePair.value.bestAgreements
    : activePair.value.worstAgreements;
});

const accentTextClass = computed(() =>
  mode.value === "most" ? "text-emerald-400" : "text-rose-400",
);

const subtitle = computed(() =>
  mode.value === "most"
    ? "The pair whose scores line up the closest"
    : "The pair whose scores clash the hardest",
);

function firstName(name: string): string {
  return name.split(" ")[0];
}
</script>
