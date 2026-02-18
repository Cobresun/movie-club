<template>
  <WidgetShell v-if="decadeStats.length > 0" title="Scores by Decade">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          !isDefined(selectedMemberId)
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = undefined"
      >
        All
      </button>
      <button
        v-for="member in members"
        :key="member.id"
        class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-all"
        :class="
          selectedMemberId === member.id
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = member.id"
      >
        <v-avatar :src="member.image" :name="member.name" :size="24" />
        {{ member.name }}
      </button>
    </div>

    <ag-charts :options="chartOptions" />
  </WidgetShell>
</template>

<script setup lang="ts">
import { AgCharts } from "ag-charts-vue3";
import { computed, ref } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { type Member } from "../../../../lib/types/club.js";
import { createDecadeChartOptions } from "../scoring";
import { computeDecadeStats } from "../statsComputers";
import type { MovieData } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  members: Member[];
  movieData: MovieData[];
}>();

const selectedMemberId = ref<string | undefined>(undefined);

const decadeStats = computed(() =>
  computeDecadeStats(props.movieData, selectedMemberId.value),
);

const chartOptions = computed(() =>
  createDecadeChartOptions(decadeStats.value),
);
</script>
