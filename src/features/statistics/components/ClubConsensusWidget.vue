<template>
  <div
    v-if="consensus.mostAgreed.length > 0"
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <WidgetShell title="Most Agreed Upon" outer-class="w-full">
      <div class="space-y-4">
        <div
          v-for="movie in consensus.mostAgreed"
          :key="movie.title"
          class="rounded-lg border border-slate-700/30 bg-background/50 p-3"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="movie.imageUrl"
              :src="movie.imageUrl"
              :alt="movie.title"
              class="h-16 w-11 shrink-0 rounded object-cover"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <span
                  class="text-sm font-medium text-white"
                  :title="movie.title"
                  >{{ movie.title }}</span
                >
                <span class="shrink-0 text-sm font-semibold text-green-400">
                  {{ movie.average.toFixed(1) }}
                </span>
              </div>
              <div
                class="mt-1 rounded bg-green-900/20 px-2 py-1 text-xs text-slate-400"
              >
                Std dev:
                <span class="font-semibold text-green-300">{{
                  movie.stdDev.toFixed(2)
                }}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="s in movie.scores"
                  :key="s.name"
                  class="rounded bg-slate-700/40 px-1.5 py-0.5 text-[0.65rem] text-slate-400"
                >
                  {{ firstName(s.name) }}: {{ s.score }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>

    <WidgetShell title="Most Divisive" outer-class="w-full">
      <div class="space-y-4">
        <div
          v-for="movie in consensus.mostDivisive"
          :key="movie.title"
          class="rounded-lg border border-slate-700/30 bg-background/50 p-3"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="movie.imageUrl"
              :src="movie.imageUrl"
              :alt="movie.title"
              class="h-16 w-11 shrink-0 rounded object-cover"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <span
                  class="text-sm font-medium text-white"
                  :title="movie.title"
                  >{{ movie.title }}</span
                >
                <span class="shrink-0 text-sm font-semibold text-red-400">
                  {{ movie.average.toFixed(1) }}
                </span>
              </div>
              <div
                class="mt-1 rounded bg-red-900/20 px-2 py-1 text-xs text-slate-400"
              >
                Std dev:
                <span class="font-semibold text-red-300">{{
                  movie.stdDev.toFixed(2)
                }}</span>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="s in movie.scores"
                  :key="s.name"
                  class="rounded bg-slate-700/40 px-1.5 py-0.5 text-[0.65rem] text-slate-400"
                >
                  {{ firstName(s.name) }}: {{ s.score }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { computeClubConsensus } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const consensus = computed(() =>
  computeClubConsensus(props.movieData, props.members),
);

function firstName(name: string): string {
  return name.split(" ")[0];
}
</script>
