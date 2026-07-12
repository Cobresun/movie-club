<template>
  <WidgetShell v-if="hasData" title="Club Consensus" :subtitle="subtitle">
    <template #controls>
      <SegmentedToggle v-model="mode" :options="MODE_OPTIONS" />
    </template>

    <div class="space-y-2">
      <div
        v-for="work in activeEntries"
        :key="work.title"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
      >
        <img
          v-if="work.imageUrl"
          :src="work.imageUrl"
          :alt="work.title"
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
            :title="work.title"
          >
            {{ work.title }}
          </p>
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="s in work.scores"
              :key="s.name"
              class="rounded bg-slate-700/40 px-1.5 py-0.5 text-xs text-slate-400"
            >
              {{ firstName(s.name) }}: {{ s.score }}
            </span>
          </div>
        </div>
        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-sm font-bold"
          :class="
            mode === 'agreed'
              ? 'bg-emerald-900/30 text-emerald-400'
              : 'bg-rose-900/30 text-rose-400'
          "
        >
          {{ work.average.toFixed(1) }}
        </span>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { computeClubConsensus } from "../statsComputers";
import type { WorkStatsData } from "../types";

type Mode = "agreed" | "divisive";

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "agreed", label: "Most Agreed" },
  { value: "divisive", label: "Most Divisive" },
];

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
}>();

const mode = ref<Mode>("agreed");

const consensus = computed(() =>
  computeClubConsensus(props.workData, props.members),
);

const hasData = computed(() => consensus.value.mostAgreed.length > 0);

const activeEntries = computed(() =>
  mode.value === "agreed"
    ? consensus.value.mostAgreed
    : consensus.value.mostDivisive,
);

const subtitle = computed(() =>
  mode.value === "agreed"
    ? "Scores that landed closest together"
    : "Scores that split the room",
);

function firstName(name: string): string {
  return name.split(" ")[0];
}
</script>
