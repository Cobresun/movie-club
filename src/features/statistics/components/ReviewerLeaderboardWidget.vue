<template>
  <div v-if="leaderboard.length > 0" class="mx-auto w-11/12">
    <div class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-4 text-lg font-bold text-white">Reviewer Stats</h3>
      <p class="mb-4 text-sm text-slate-400">
        Average score per member
      </p>
      <ul class="space-y-3">
        <li
          v-for="entry in leaderboard"
          :key="entry.member.id"
          class="flex items-center justify-between rounded-lg px-3 py-2"
        >
          <div class="flex items-center gap-3">
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
                :class="titleBadgeClass(entry.title)"
              >
                {{ entry.title }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span
              class="min-w-[3.5rem] rounded px-2 py-1 text-center font-semibold text-slate-300"
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

function titleBadgeClass(title: string): string {
  if (title === "The Softie") return "bg-amber-900/50 text-amber-300";
  return "bg-red-900/50 text-red-300";
}
</script>
