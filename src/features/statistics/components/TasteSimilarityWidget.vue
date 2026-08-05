<template>
  <WidgetShell v-if="hasData" title="Taste Similarity" :subtitle="subtitle">
    <template #controls>
      <div class="flex flex-wrap items-center gap-2">
        <SegmentedToggle v-if="scopeOptions.length > 1" v-model="scope" :options="scopeOptions" />
        <SegmentedToggle v-model="mode" :options="modeOptions" />
      </div>
    </template>

    <div v-if="activePair" class="text-left">
      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar :src="activePair.memberA.image" :name="activePair.memberA.name" :size="48" />
          <span class="mt-1 text-xs text-slate-300">{{ memberLabel(activePair.memberA) }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold" :class="accentTextClass"
            >{{ activePair.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar :src="activePair.memberB.image" :name="activePair.memberB.name" :size="48" />
          <span class="mt-1 text-xs text-slate-300">{{ memberLabel(activePair.memberB) }}</span>
        </div>
      </div>

      <div
        class="mb-3 rounded px-3 py-2 text-sm text-slate-300"
        :class="mode === 'most' ? 'bg-emerald-900/20' : 'bg-rose-900/20'"
      >
        Average score difference:
        <span class="font-semibold" :class="accentTextClass">{{ activePair.avgDifference }}</span>
        points across {{ activePair.sharedCount }} shared reviews
      </div>

      <div v-if="highlightMovies.length > 0">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ mode === "most" ? "Top agreements" : "Biggest disagreements" }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in highlightMovies"
            :key="movie.title"
            class="flex items-center justify-between text-sm"
          >
            <span class="truncate text-slate-300" :title="movie.title">{{ movie.title }}</span>
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

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { computeTasteSimilarity } from "../statsComputers";
import type { WorkStatsData } from "../types";
import SegmentedToggle from "./SegmentedToggle.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { firstName } from "@/common/memberName";

type Mode = "most" | "least";
type Scope = "club" | "you";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  /** Set when the viewer is signed in; unlocks the "You" scope if they're a club member. */
  currentUserId?: string;
}>();

const clubSimilarity = computed(() => computeTasteSimilarity(props.workData, props.members));

// Only worth computing when the viewer is actually one of this club's members
// — an anonymous or non-member viewer has no pairs of their own.
const userSimilarity = computed(() => {
  if (!hasValue(props.currentUserId)) return { mostSimilar: null, leastSimilar: null };
  return computeTasteSimilarity(props.workData, props.members, props.currentUserId);
});

const scopeOptions = computed(() => {
  const options: { value: Scope; label: string }[] = [{ value: "club", label: "Club" }];
  if (isDefined(userSimilarity.value.mostSimilar)) {
    options.push({ value: "you", label: "You" });
  }
  return options;
});

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedScope = ref<Scope>("club");
const scope = computed<Scope>({
  get: () =>
    scopeOptions.value.some((option) => option.value === selectedScope.value)
      ? selectedScope.value
      : "club",
  set: (value) => {
    selectedScope.value = value;
  },
});

const tasteSimilarity = computed(() =>
  scope.value === "you" ? userSimilarity.value : clubSimilarity.value,
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
  mode.value === "most" ? tasteSimilarity.value.mostSimilar : tasteSimilarity.value.leastSimilar,
);

const highlightMovies = computed(() => {
  if (!isDefined(activePair.value)) return [];
  return mode.value === "most" ? activePair.value.bestAgreements : activePair.value.worstAgreements;
});

const accentTextClass = computed(() =>
  mode.value === "most" ? "text-emerald-400" : "text-rose-400",
);

const SUBTITLES: Record<Scope, Record<Mode, string>> = {
  club: {
    most: "The pair whose scores line up the closest",
    least: "The pair whose scores clash the hardest",
  },
  you: {
    most: "The member whose scores line up closest with yours",
    least: "The member whose scores clash hardest with yours",
  },
};

const subtitle = computed(() => SUBTITLES[scope.value][mode.value]);

function memberLabel(member: { id: string; name: string }): string {
  if (scope.value === "you" && member.id === props.currentUserId) return "You";
  return firstName(member.name);
}
</script>
