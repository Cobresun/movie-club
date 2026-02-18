<template>
  <div
    v-if="
      deviation.clubRatedHigher.length > 0 ||
      deviation.clubRatedLower.length > 0
    "
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <WidgetShell
      v-if="deviation.clubRatedHigher.length > 0"
      title="Club Rated Higher"
      outer-class="w-full"
    >
      <div class="space-y-2">
        <div
          v-for="entry in deviation.clubRatedHigher"
          :key="entry.title"
          class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
        >
          <img
            v-if="entry.imageUrl"
            :src="entry.imageUrl"
            :alt="entry.title"
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
              class="truncate text-sm font-medium text-white"
              :title="entry.title"
            >
              {{ entry.title }}
            </p>
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span>Club: {{ entry.clubScore }}</span>
              <span class="text-slate-600">|</span>
              <span>TMDB: {{ entry.tmdbScore }}</span>
            </div>
          </div>

          <span
            class="shrink-0 rounded-full bg-green-900/30 px-2 py-0.5 text-xs font-semibold text-green-400"
          >
            +{{ entry.deviation }}
          </span>
        </div>
      </div>
    </WidgetShell>

    <WidgetShell
      v-if="deviation.clubRatedLower.length > 0"
      title="Club Rated Lower"
      outer-class="w-full"
    >
      <div class="space-y-2">
        <div
          v-for="entry in deviation.clubRatedLower"
          :key="entry.title"
          class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
        >
          <img
            v-if="entry.imageUrl"
            :src="entry.imageUrl"
            :alt="entry.title"
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
              class="truncate text-sm font-medium text-white"
              :title="entry.title"
            >
              {{ entry.title }}
            </p>
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span>Club: {{ entry.clubScore }}</span>
              <span class="text-slate-600">|</span>
              <span>TMDB: {{ entry.tmdbScore }}</span>
            </div>
          </div>

          <span
            class="shrink-0 rounded-full bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-400"
          >
            {{ entry.deviation }}
          </span>
        </div>
      </div>
    </WidgetShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { computeTmdbDeviation } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const deviation = computed(() => computeTmdbDeviation(props.movieData));
</script>
