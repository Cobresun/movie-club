<template>
  <WidgetShell v-if="hasData" title="Through the Years" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <template v-if="mode === 'decades'">
      <MemberFilterChips
        v-model="selectedMemberId"
        :members="members"
        class="mb-4"
      />
      <ag-charts :options="decadeChartOptions" />
    </template>

    <div v-else class="space-y-2">
      <div
        v-for="entry in yearlyBest"
        :key="entry.year"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
      >
        <span class="w-12 shrink-0 text-lg font-bold text-primary">
          {{ entry.year }}
        </span>
        <img
          v-if="entry.imageUrl"
          :src="entry.imageUrl"
          :alt="entry.title"
          class="h-14 w-10 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>
        <div class="min-w-0 flex-1 text-left">
          <p
            class="w-fit max-w-full truncate text-sm font-medium text-white"
            :title="entry.title"
          >
            {{ entry.title }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ entry.workCount }}
            {{ entry.workCount === 1 ? noun : `${noun}s` }} reviewed
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-emerald-900/30 px-2.5 py-1 text-sm font-bold text-emerald-400"
        >
          {{ entry.average.toFixed(1) }}
        </span>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed, ref } from "vue";

import MemberFilterChips from "./MemberFilterChips.vue";
import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { type Member } from "../../../../lib/types/club.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { createDecadeChartOptions } from "../scoring";
import {
  computeDecadeStats,
  computeHighestRatedByYear,
  computePublishDecadeStats,
} from "../statsComputers";
import {
  isBookStats,
  isMovieStats,
  type DecadeStats,
  type WorkStatsData,
} from "../types";

import { clubTypeConfig, clubTypeStats } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

type Mode = "decades" | "years";

/**
 * What "decade" means per club type: a movie's release decade vs a book's
 * publication decade. Feature-local registry (depends on statistics types), per
 * code-quality.md — a new club type adds an entry instead of a conditional.
 */
const ERA_CONFIG: Record<
  ClubType,
  {
    decades: (works: WorkStatsData[], memberId?: string) => DecadeStats[];
    decadesSubtitle: string;
  }
> = {
  [ClubType.movie]: {
    decades: (works, memberId) =>
      computeDecadeStats(works.filter(isMovieStats), memberId),
    decadesSubtitle: "Average score by release decade",
  },
  [ClubType.book]: {
    decades: (works, memberId) =>
      computePublishDecadeStats(works.filter(isBookStats), memberId),
    decadesSubtitle: "Average score by publication decade",
  },
};

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  clubType: ClubType;
}>();

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const selectedMemberId = ref<string | undefined>(undefined);

const eraConfig = computed(() => ERA_CONFIG[props.clubType]);
const noun = computed(() => clubTypeConfig(props.clubType).noun);
const pluralNoun = computed(() => clubTypeStats(props.clubType).pluralNoun);

const decadeStats = computed(() =>
  eraConfig.value.decades(props.workData, selectedMemberId.value),
);
const yearlyBest = computed(() => computeHighestRatedByYear(props.workData));

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (decadeStats.value.length > 0) {
    options.push({ value: "decades", label: "By Decade" });
  }
  if (yearlyBest.value.length > 0) {
    options.push({ value: "years", label: "Best of Year" });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first available tab when the selected one has no data,
// instead of watching for changes (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("decades");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "decades"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const subtitle = computed(() =>
  mode.value === "decades"
    ? eraConfig.value.decadesSubtitle
    : `The top-rated ${noun.value} from each year of your club`,
);

const decadeChartOptions = computed(() =>
  createDecadeChartOptions(decadeStats.value, pluralNoun.value, compact.value),
);
</script>
