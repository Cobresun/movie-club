<template>
  <div
    v-if="genreStats.mostLoved.length > 0 || genreStats.leastLoved.length > 0"
  >
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <button
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          !isDefined(selectedMemberId)
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
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
            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
        "
        @click="selectedMemberId = member.id"
      >
        <v-avatar :src="member.image" :name="member.name" :size="24" />
        {{ member.name }}
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <WidgetShell
        v-if="genreStats.mostLoved.length > 0"
        title="Most Loved Genres"
        icon="heart"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in genreStats.mostLoved"
            :key="genre.genre"
          >
            <div class="mb-1.5 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-5 w-1 shrink-0 rounded-full bg-green-400" />
                <div>
                  <span class="text-sm text-white">{{ genre.genre }}</span>
                  <span class="ml-2 text-xs text-slate-500">#{{ index + 1 }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-xs text-slate-400">{{ genre.count }} films</span>
                <span
                  class="min-w-[3rem] rounded bg-green-900/50 px-2 py-0.5 text-center text-xs font-semibold text-green-300"
                >
                  {{ genre.averageScore }}
                </span>
              </div>
            </div>
            <div class="h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
              <div
                class="h-full rounded-full bg-green-400/60"
                :style="{ width: scoreBarWidth(genre.averageScore) + '%' }"
              />
            </div>
          </li>
        </ul>
      </WidgetShell>

      <WidgetShell
        v-if="genreStats.leastLoved.length > 0"
        title="Least Loved Genres"
        icon="heart-broken"
        outer-class="w-full"
      >
        <ul class="space-y-3">
          <li
            v-for="(genre, index) in genreStats.leastLoved"
            :key="genre.genre"
          >
            <div class="mb-1.5 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-5 w-1 shrink-0 rounded-full bg-red-400" />
                <div>
                  <span class="text-sm text-white">{{ genre.genre }}</span>
                  <span class="ml-2 text-xs text-slate-500">#{{ index + 1 }}</span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-xs text-slate-400">{{ genre.count }} films</span>
                <span
                  class="min-w-[3rem] rounded bg-red-900/50 px-2 py-0.5 text-center text-xs font-semibold text-red-300"
                >
                  {{ genre.averageScore }}
                </span>
              </div>
            </div>
            <div class="h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
              <div
                class="h-full rounded-full bg-red-400/60"
                :style="{ width: scoreBarWidth(genre.averageScore) + '%' }"
              />
            </div>
          </li>
        </ul>
      </WidgetShell>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { type Member } from "../../../../lib/types/club.js";
import { computeGenreStats } from "../statsComputers";
import type { MovieData } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  members: Member[];
  movieData: MovieData[];
}>();

const selectedMemberId = ref<string | undefined>(undefined);

const genreStats = computed(() =>
  computeGenreStats(props.movieData, selectedMemberId.value),
);

function scoreBarWidth(score: number): number {
  return Math.round((score / 10) * 100);
}
</script>
