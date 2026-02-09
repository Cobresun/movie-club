<template>
  <div v-if="leaderboard.length > 0" class="mx-auto w-11/12">
    <div class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-4 text-lg font-bold text-white">Reviewer Leaderboard</h3>
      <p class="mb-4 text-sm text-slate-400">
        Least to most critical by average score
      </p>
      <ul class="space-y-3">
        <li
          v-for="(entry, index) in leaderboard"
          :key="entry.member.id"
          class="flex items-center justify-between rounded-lg px-3 py-2"
          :class="entryBackground(index)"
        >
          <div class="flex items-center gap-3">
            <span class="w-6 text-center text-lg font-bold text-slate-400">
              {{ index + 1 }}
            </span>
            <v-avatar
              :src="entry.member.image"
              :name="entry.member.name"
              :size="36"
            />
            <div>
              <span class="font-medium text-white">
                {{ entry.member.name }}
              </span>
              <span
                v-if="entry.title"
                class="ml-2 rounded px-2 py-0.5 text-xs font-semibold"
                :class="titleBadgeClass(index)"
              >
                {{ entry.title }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span
              class="min-w-[3.5rem] rounded px-2 py-1 text-center font-semibold"
              :class="scoreBadgeClass(index)"
            >
              {{ entry.averageScore }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MemberLeaderboardEntry } from "../StatisticsUtils";

defineProps<{
  leaderboard: MemberLeaderboardEntry[];
}>();

function entryBackground(index: number): string {
  if (index === 0) return "bg-amber-900/20";
  return "";
}

function titleBadgeClass(index: number): string {
  if (index === 0) return "bg-amber-900/50 text-amber-300";
  return "bg-red-900/50 text-red-300";
}

function scoreBadgeClass(index: number): string {
  if (index === 0) return "bg-green-900/50 text-green-300";
  return "bg-slate-700/50 text-slate-300";
}
</script>
