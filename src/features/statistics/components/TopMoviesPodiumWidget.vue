<template>
  <WidgetShell v-if="movieData.length > 0" title="Top 5 Movies">
    <div
      v-if="members.length > 1"
      class="mb-4 flex flex-wrap items-center gap-2"
    >
      <button
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
        :class="
          !isDefined(selectedMemberId)
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
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
            : 'bg-lowBackground text-gray-400 hover:bg-gray-600 hover:text-white'
        "
        @click="selectedMemberId = member.id"
      >
        <v-avatar :src="member.image" :name="member.name" :size="24" />
        {{ member.name }}
      </button>
    </div>

    <p
      v-if="topMovies.length === 0"
      class="py-6 text-center text-sm text-slate-500"
    >
      No scored movies for this selection yet.
    </p>

    <template v-else>
      <div class="flex items-end justify-center gap-3 sm:gap-6">
        <div
          v-for="stand in podiumStands"
          :key="stand.rank"
          class="flex w-1/4 max-w-[10rem] flex-col items-center"
        >
          <div class="mb-1 text-3xl leading-none sm:text-4xl">
            {{ stand.medal }}
          </div>
          <div
            v-for="movie in stand.movies"
            :key="movie.id"
            class="mb-2 flex w-full flex-col items-center"
          >
            <img
              v-if="movie.imageUrl"
              v-lazy-load
              :src="movie.imageUrl"
              :alt="movie.title"
              class="mb-2 h-24 w-16 rounded object-cover shadow-lg sm:h-28 sm:w-20"
            />
            <div
              v-else
              class="mb-2 flex h-24 w-16 items-center justify-center rounded bg-slate-700/60 text-xl font-bold text-slate-300 shadow-lg sm:h-28 sm:w-20"
            >
              {{ movie.title.charAt(0) }}
            </div>
            <p
              class="mb-1 line-clamp-2 w-full text-center text-xs font-semibold text-white sm:text-sm"
              :title="movie.title"
            >
              {{ movie.title }}
            </p>
            <span
              class="text-sm font-bold sm:text-base"
              :class="scoreColor(movie.average)"
            >
              {{ movie.average.toFixed(1) }}
            </span>
          </div>
          <div
            class="flex w-full items-start justify-center rounded-t-md border-x border-t pt-2 text-lg font-bold sm:text-xl"
            :class="[stand.standClass, stand.standHeight]"
          >
            {{ stand.rank }}
          </div>
        </div>
      </div>

      <div
        v-if="runnersUp.length > 0"
        class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div
          v-for="movie in runnersUp"
          :key="movie.id"
          class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
        >
          <span
            class="w-8 shrink-0 text-center text-sm font-bold text-slate-400"
          >
            #{{ movie.rank }}
          </span>
          <img
            v-if="movie.imageUrl"
            v-lazy-load
            :src="movie.imageUrl"
            :alt="movie.title"
            class="h-14 w-10 shrink-0 rounded object-cover"
          />
          <div
            v-else
            class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/60 text-sm font-bold text-slate-400"
          >
            {{ movie.title.charAt(0) }}
          </div>
          <p
            class="min-w-0 flex-1 truncate text-sm font-medium text-white"
            :title="movie.title"
          >
            {{ movie.title }}
          </p>
          <span
            class="shrink-0 text-sm font-semibold"
            :class="scoreColor(movie.average)"
          >
            {{ movie.average.toFixed(1) }}
          </span>
        </div>
      </div>
    </template>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { isDefined } from "../../../../lib/checks/checks";
import { type Member } from "../../../../lib/types/club";
import { computeTopMovies } from "../statsComputers";
import type { MovieData, TopMovieEntry } from "../types";

import VAvatar from "@/common/components/VAvatar.vue";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const selectedMemberId = ref<string | undefined>(undefined);

const topMovies = computed(() =>
  computeTopMovies(props.movieData, selectedMemberId.value),
);

interface PodiumStand {
  rank: number;
  movies: TopMovieEntry[];
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

const podiumStands = computed<PodiumStand[]>(() => {
  return PODIUM_LAYOUT.flatMap((layout) => {
    const movies = topMovies.value.filter((m) => m.rank === layout.rank);
    if (movies.length === 0) return [];
    return [{ ...layout, movies }];
  });
});

const runnersUp = computed(() =>
  topMovies.value.filter((movie) => movie.rank > 3),
);

function scoreColor(score: number): string {
  if (score >= 7.5) return "text-emerald-400";
  if (score >= 5) return "text-primary";
  return "text-orange-400";
}
</script>
