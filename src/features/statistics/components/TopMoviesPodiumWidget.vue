<template>
  <WidgetShell
    v-if="topMovies.length > 0"
    title="Top 5 Movies"
    outer-class="w-full"
    inner-class="rounded-xl border border-slate-700/50 bg-lowBackground/60 p-6"
  >
    <div class="flex items-end justify-center gap-3 sm:gap-6">
      <div
        v-for="position in podiumPositions"
        :key="position.rank"
        class="flex w-1/4 max-w-[10rem] flex-col items-center"
      >
        <div class="mb-1 text-3xl leading-none sm:text-4xl">
          {{ position.medal }}
        </div>
        <img
          v-if="position.movie.imageUrl"
          v-lazy-load
          :src="position.movie.imageUrl"
          :alt="position.movie.title"
          class="mb-2 h-24 w-16 rounded object-cover shadow-lg sm:h-28 sm:w-20"
        />
        <div
          v-else
          class="mb-2 flex h-24 w-16 items-center justify-center rounded bg-slate-700/60 text-xl font-bold text-slate-300 shadow-lg sm:h-28 sm:w-20"
        >
          {{ position.movie.title.charAt(0) }}
        </div>
        <p
          class="mb-1 line-clamp-2 w-full text-center text-xs font-semibold text-white sm:text-sm"
          :title="position.movie.title"
        >
          {{ position.movie.title }}
        </p>
        <span
          class="mb-2 text-sm font-bold sm:text-base"
          :class="scoreColor(position.movie.average)"
        >
          {{ position.movie.average.toFixed(1) }}
        </span>
        <div
          class="flex w-full items-start justify-center rounded-t-md border-x border-t pt-2 text-lg font-bold sm:text-xl"
          :class="[position.standClass, position.standHeight]"
        >
          {{ position.rank }}
        </div>
      </div>
    </div>

    <div
      v-if="runnersUp.length > 0"
      class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div
        v-for="movie in runnersUp"
        :key="movie.entry.id"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
      >
        <span class="w-6 shrink-0 text-center text-sm font-bold text-slate-400">
          #{{ movie.rank }}
        </span>
        <img
          v-if="movie.entry.imageUrl"
          v-lazy-load
          :src="movie.entry.imageUrl"
          :alt="movie.entry.title"
          class="h-14 w-10 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/60 text-sm font-bold text-slate-400"
        >
          {{ movie.entry.title.charAt(0) }}
        </div>
        <p
          class="min-w-0 flex-1 truncate text-sm font-medium text-white"
          :title="movie.entry.title"
        >
          {{ movie.entry.title }}
        </p>
        <span
          class="shrink-0 text-sm font-semibold"
          :class="scoreColor(movie.entry.average)"
        >
          {{ movie.entry.average.toFixed(1) }}
        </span>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks";
import { computeTopMovies } from "../statsComputers";
import type { MovieData, TopMovieEntry } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const topMovies = computed(() => computeTopMovies(props.movieData));

interface PodiumPosition {
  rank: number;
  movie: TopMovieEntry;
  medal: string;
  standClass: string;
  standHeight: string;
}

const PODIUM_LAYOUT: ReadonlyArray<{
  rank: number;
  medal: string;
  standClass: string;
  standHeight: string;
}> = [
  {
    rank: 2,
    medal: "\u{1F948}",
    standClass: "bg-slate-400/30 border-slate-300/50 text-slate-200",
    standHeight: "h-20 sm:h-24",
  },
  {
    rank: 1,
    medal: "\u{1F947}",
    standClass: "bg-amber-500/30 border-amber-400/60 text-amber-200",
    standHeight: "h-28 sm:h-32",
  },
  {
    rank: 3,
    medal: "\u{1F949}",
    standClass: "bg-orange-600/30 border-orange-500/60 text-orange-200",
    standHeight: "h-14 sm:h-16",
  },
];

const podiumPositions = computed<PodiumPosition[]>(() => {
  return PODIUM_LAYOUT.flatMap((layout) => {
    const movie = topMovies.value[layout.rank - 1];
    if (!isDefined(movie)) return [];
    return [{ ...layout, movie }];
  });
});

const runnersUp = computed(() =>
  topMovies.value.slice(3).map((entry, idx) => ({
    rank: idx + 4,
    entry,
  })),
);

function scoreColor(score: number): string {
  if (score >= 7.5) return "text-emerald-400";
  if (score >= 5) return "text-primary";
  return "text-orange-400";
}
</script>
