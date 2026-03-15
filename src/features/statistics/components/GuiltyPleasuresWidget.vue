<template>
  <WidgetShell v-if="guiltyPleasures.length > 0" title="Guilty Pleasures">
    <p class="mb-4 text-sm text-slate-400">
      Movies where only one member loved it (2+ points above club average)
    </p>
    <div class="space-y-5">
      <div
        v-for="entry in guiltyPleasures"
        :key="entry.member.id"
        class="space-y-2"
      >
        <div class="flex items-center gap-2">
          <v-avatar
            :src="entry.member.image"
            :name="entry.member.name"
            size="sm"
          />
          <span class="text-sm font-semibold text-white">
            {{ entry.member.name }}
          </span>
          <span class="text-xs text-slate-500">
            {{ entry.movies.length }}
            {{ entry.movies.length === 1 ? "movie" : "movies" }}
          </span>
        </div>
        <div class="space-y-1.5 pl-8">
          <div
            v-for="movie in entry.movies"
            :key="movie.title"
            class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
          >
            <img
              v-if="movie.imageUrl"
              :src="movie.imageUrl"
              :alt="movie.title"
              class="h-12 w-8 shrink-0 rounded object-cover"
            />
            <div
              v-else
              class="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
            >
              ?
            </div>
            <div class="min-w-0 flex-1">
              <p
                class="w-fit max-w-full truncate text-sm font-medium text-white"
                :title="movie.title"
              >
                {{ movie.title }}
              </p>
              <p class="text-xs text-slate-400">
                Club avg: {{ movie.clubAverage.toFixed(1) }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <span
                class="rounded-full bg-pink-900/30 px-2.5 py-1 text-sm font-bold text-pink-400"
              >
                {{ movie.memberScore.toFixed(1) }}
              </span>
              <p class="mt-0.5 text-xs text-pink-400/70">
                +{{ movie.difference.toFixed(1) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { computeGuiltyPleasures } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const guiltyPleasures = computed(() =>
  computeGuiltyPleasures(props.movieData, props.members),
);
</script>
