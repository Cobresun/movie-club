<template>
  <WidgetShell
    v-if="leaderboard.length > 0"
    title="Reviewer Stats"
    subtitle="Average score per member — chart colors match"
  >
    <ul class="space-y-3">
      <li
        v-for="entry in leaderboard"
        :key="entry.member.id"
        class="rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <v-avatar :src="entry.member.image" :name="entry.member.name" :size="36" />
            <div class="min-w-0 text-left">
              <div class="flex items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: memberColor(entry.member.id) }"
                />
                <span class="truncate font-medium text-white">
                  {{ entry.member.name }}
                </span>
                <span
                  v-if="entry.title"
                  class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold"
                  :class="titleBadgeClass(entry.title)"
                >
                  {{ entry.title }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-slate-400">
                {{ entry.reviewCount }}
                {{ entry.reviewCount === 1 ? "review" : "reviews" }}
              </p>
            </div>
          </div>
          <span class="shrink-0 text-lg font-bold text-white">
            {{ entry.averageScore.toFixed(1) }}
          </span>
        </div>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{
              width: `${(entry.averageScore / 10) * 100}%`,
              backgroundColor: memberColor(entry.member.id),
            }"
          />
        </div>
      </li>
    </ul>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Member } from "../../../../lib/types/club";
import { memberSeriesColor } from "../chartPalette";
import { computeMemberLeaderboard } from "../statsComputers";
import type { WorkStatsData } from "../types";
import WidgetShell from "./WidgetShell.vue";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
}>();

const leaderboard = computed(() => computeMemberLeaderboard(props.workData, props.members));

// Same color the member wears in every chart: their slot in the member list.
function memberColor(memberId: string): string {
  const index = props.members.findIndex((member) => member.id === memberId);
  return memberSeriesColor(Math.max(0, index));
}

function titleBadgeClass(title: string): string {
  if (title === "The Softie") return "bg-emerald-900/40 text-emerald-300";
  return "bg-rose-900/40 text-rose-300";
}
</script>
