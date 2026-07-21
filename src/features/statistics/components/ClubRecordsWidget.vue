<template>
  <WidgetShell v-if="tiles.length > 0" title="Club Records">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div
        v-for="tile in tiles"
        :key="tile.label"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 p-3 text-left"
      >
        <img
          v-if="tile.entry.imageUrl"
          :src="tile.entry.imageUrl"
          :alt="tile.entry.title"
          class="h-16 w-11 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold uppercase tracking-wide" :class="tile.labelClass">
            {{ tile.label }}
          </p>
          <p class="mt-0.5 truncate text-sm font-medium text-white" :title="tile.entry.title">
            {{ tile.entry.title }}
          </p>
          <span
            class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold"
            :class="tile.chipClass"
          >
            {{ tile.value }}
          </span>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { computeClubRecords } from "../statsComputers";
import type { ClubRecordEntry, WorkStatsData } from "../types";
import WidgetShell from "./WidgetShell.vue";

const props = defineProps<{
  workData: WorkStatsData[];
}>();

const records = computed(() => computeClubRecords(props.workData));

interface RecordTile {
  label: string;
  labelClass: string;
  chipClass: string;
  entry: ClubRecordEntry;
  value: string;
}

const tiles = computed<RecordTile[]>(() => {
  const result: RecordTile[] = [];
  const { highest, lowest, mostDivisive } = records.value;

  if (isDefined(highest)) {
    result.push({
      label: "Highest Rated",
      labelClass: "text-emerald-400",
      chipClass: "bg-emerald-900/30 text-emerald-300",
      entry: highest,
      value: highest.value.toFixed(1),
    });
  }
  if (isDefined(lowest)) {
    result.push({
      label: "Lowest Rated",
      labelClass: "text-rose-400",
      chipClass: "bg-rose-900/30 text-rose-300",
      entry: lowest,
      value: lowest.value.toFixed(1),
    });
  }
  if (isDefined(mostDivisive)) {
    result.push({
      label: "Most Divisive",
      labelClass: "text-primary",
      chipClass: "bg-primary/15 text-highlight",
      entry: mostDivisive,
      value: `±${mostDivisive.value.toFixed(1)} spread`,
    });
  }
  return result;
});
</script>
