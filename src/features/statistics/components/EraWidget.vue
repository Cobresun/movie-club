<template>
  <WidgetShell v-if="hasData" title="Through the Years" :subtitle="subtitle">
    <MemberFilterChips
      v-model="selectedMemberId"
      :members="members"
      class="mb-4"
    />
    <ag-charts :options="decadeChartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed, ref } from "vue";

import MemberFilterChips from "./MemberFilterChips.vue";
import WidgetShell from "./WidgetShell.vue";
import { type Member } from "../../../../lib/types/club.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { createDecadeChartOptions } from "../scoring";
import {
  computeDecadeStats,
  computePublishDecadeStats,
} from "../statsComputers";
import {
  isBookStats,
  isMovieStats,
  type DecadeStats,
  type WorkStatsData,
} from "../types";

import { clubTypeStats } from "@/common/clubType";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

/**
 * What "decade" means per club type: a movie's release decade vs a book's
 * publication decade. Feature-local registry (depends on statistics types), per
 * code-quality.md — a new club type adds an entry instead of a conditional.
 *
 * This widget is purely about a work's *origin* year (when it was released or
 * published). Stats about when the *club* reviewed a work live in
 * ActivityWidget, keeping the two notions of "year" in separate widgets.
 */
const ERA_CONFIG: Record<
  ClubType,
  {
    decades: (works: WorkStatsData[], memberId?: string) => DecadeStats[];
    subtitle: string;
  }
> = {
  [ClubType.movie]: {
    decades: (works, memberId) =>
      computeDecadeStats(works.filter(isMovieStats), memberId),
    subtitle: "Average score by release decade",
  },
  [ClubType.book]: {
    decades: (works, memberId) =>
      computePublishDecadeStats(works.filter(isBookStats), memberId),
    subtitle: "Average score by publication decade",
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
const pluralNoun = computed(() => clubTypeStats(props.clubType).pluralNoun);

const decadeStats = computed(() =>
  eraConfig.value.decades(props.workData, selectedMemberId.value),
);

const hasData = computed(() => decadeStats.value.length > 0);

const subtitle = computed(() => eraConfig.value.subtitle);

const decadeChartOptions = computed(() =>
  createDecadeChartOptions(decadeStats.value, pluralNoun.value, compact.value),
);
</script>
