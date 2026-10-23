<template>
  <WidgetShell
    v-if="leaderboard.length > 1"
    title="Who Picks Best?"
    :subtitle="`Club average for the ${noun}s each member added`"
  >
    <ul class="space-y-3" aria-label="Pick leaderboard">
      <li
        v-for="(entry, index) in leaderboard"
        :key="entry.member.id"
        class="rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5 text-left"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <v-avatar :src="entry.member.image" :name="entry.member.name" :size="36" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium text-white">{{ entry.member.name }}</span>
                <span
                  v-if="badge(index)"
                  class="shrink-0 rounded px-2 py-0.5 text-xs font-semibold"
                  :class="
                    index === 0
                      ? 'bg-emerald-900/40 text-emerald-300'
                      : 'bg-rose-900/40 text-rose-300'
                  "
                >
                  {{ badge(index) }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-slate-400">
                {{ entry.pickCount }} {{ entry.pickCount === 1 ? noun : `${noun}s` }} added
              </p>
            </div>
          </div>
          <span class="shrink-0 text-lg font-bold text-white">
            {{ entry.averageScore.toFixed(1) }}
          </span>
        </div>
        <dl class="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-emerald-400">Best pick</dt>
            <dd class="truncate text-slate-300">
              {{ entry.best.title }} ({{ entry.best.value.toFixed(1) }})
            </dd>
          </div>
          <div v-if="entry.pickCount > 1" class="flex min-w-0 gap-1.5">
            <dt class="shrink-0 font-semibold text-rose-400">Worst pick</dt>
            <dd class="truncate text-slate-300">
              {{ entry.worst.title }} ({{ entry.worst.value.toFixed(1) }})
            </dd>
          </div>
        </dl>
      </li>
    </ul>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import { computePickerLeaderboard } from "../statsComputers";
import type { WorkStatsData } from "../types";
import { clubTypeConfig } from "@/common/clubType";
import WidgetShell from "@/common/components/WidgetShell.vue";

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  clubType: ClubType;
}>();

const leaderboard = computed(() => computePickerLeaderboard(props.workData, props.members));
const noun = computed(() => clubTypeConfig(props.clubType).noun);

function badge(index: number): string | undefined {
  if (index === 0) return "Best Taste";
  if (index === leaderboard.value.length - 1) return "Worst Taste";
  return undefined;
}
</script>
