<template>
  <WidgetShell
    outer-class="max-w-2xl"
    inner-class="rounded-xl border border-slate-700/50 bg-lowBackground/60 p-6"
  >
    <h3 class="mb-5 text-center text-lg font-semibold text-white">
      Most Watched Directors
    </h3>

    <div class="space-y-3">
      <div
        v-for="(director, index) in topDirectors"
        :key="director.name"
        class="group relative overflow-hidden rounded-lg border border-slate-700/30 bg-background/50 px-4 py-3 transition-colors hover:border-slate-600/50 hover:bg-background/80"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            :class="rankClass(index)"
          >
            {{ index + 1 }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium text-white">
                {{ director.name }}
              </span>
              <div class="flex shrink-0 items-center gap-3">
                <span class="text-xs text-slate-400">
                  {{ director.movieCount }}
                  {{ director.movieCount === 1 ? "film" : "films" }}
                </span>
                <span
                  class="min-w-[2.5rem] text-right text-sm font-semibold"
                  :class="scoreColor(director.averageScore)"
                >
                  {{ director.averageScore.toFixed(1) }}
                </span>
              </div>
            </div>

            <div
              class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50"
            >
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="barColor(director.averageScore)"
                :style="{ width: barWidth(director.averageScore) + '%' }"
              />
            </div>
          </div>
        </div>

        <div class="mt-2 flex flex-wrap gap-1 pl-12">
          <span
            v-for="movie in director.movies"
            :key="movie"
            class="inline-block max-w-[10rem] truncate rounded bg-slate-700/40 px-1.5 py-0.5 text-[0.65rem] text-slate-400"
          >
            {{ movie }}
          </span>
        </div>
      </div>
    </div>

    <p
      v-if="topDirectors.length === 0"
      class="py-4 text-center text-sm text-slate-500"
    >
      No director data available yet.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { computeTopDirectors } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const topDirectors = computed(() => computeTopDirectors(props.movieData));

function rankClass(index: number): string {
  switch (index) {
    case 0:
      return "bg-amber-500/20 text-amber-400";
    case 1:
      return "bg-slate-400/20 text-slate-300";
    case 2:
      return "bg-orange-600/20 text-orange-400";
    default:
      return "bg-slate-600/20 text-slate-400";
  }
}

function scoreColor(score: number): string {
  if (score >= 7.5) return "text-emerald-400";
  if (score >= 5) return "text-primary";
  return "text-orange-400";
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
