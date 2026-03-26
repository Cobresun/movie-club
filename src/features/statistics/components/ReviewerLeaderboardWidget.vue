<template>
  <WidgetShell v-if="leaderboard.length > 0" title="Reviewer Stats" icon="account-group">
    <p class="mb-4 text-xs text-slate-400">Average score per member</p>
    <ul class="space-y-3">
      <li
        v-for="entry in leaderboard"
        :key="entry.member.id"
        class="flex items-center gap-3 rounded-lg px-3 py-2"
      >
        <v-avatar
          :src="entry.member.image"
          :name="entry.member.name"
          :size="36"
        />
        <div class="min-w-0 flex-1">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="font-medium text-white">
                {{ entry.member.name }}
              </span>
              <span
                v-if="entry.title"
                class="rounded px-2 py-0.5 text-xs font-semibold"
                :class="titleBadgeClass(entry.title)"
              >
                {{ entry.title }}
              </span>
            </div>
            <span class="shrink-0 text-sm font-bold text-white">
              {{ entry.averageScore }}
            </span>
          </div>
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="barColor(Number(entry.averageScore))"
              :style="{ width: barWidth(Number(entry.averageScore)) + '%' }"
            />
          </div>
        </div>
      </li>
    </ul>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { computeMemberLeaderboard } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const leaderboard = computed(() =>
  computeMemberLeaderboard(props.movieData, props.members),
);

function titleBadgeClass(title: string): string {
  if (title === "The Softie") return "bg-amber-900/50 text-amber-300";
  return "bg-red-900/50 text-red-300";
}

function barColor(score: number): string {
  if (score >= 7.5) return "bg-emerald-500/70";
  if (score >= 5) return "bg-primary/70";
  return "bg-orange-500/70";
}

function barWidth(score: number): number {
  return (score / 10) * 100;
}
</script>
