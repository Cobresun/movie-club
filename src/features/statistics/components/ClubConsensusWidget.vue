<template>
  <div
    v-if="consensus.mostAgreed.length > 0"
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <WidgetShell title="Most Agreed Upon" outer-class="w-full">
      <div class="space-y-2">
        <div
          v-for="movie in consensus.mostAgreed"
          :key="movie.title"
          class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
        >
          <img
            v-if="movie.imageUrl"
            :src="movie.imageUrl"
            :alt="movie.title"
            class="h-14 w-10 shrink-0 rounded object-cover"
          />
          <div
            v-else
            class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
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
            <div class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="s in movie.scores"
                :key="s.name"
                class="rounded bg-slate-700/40 px-1.5 py-0.5 text-xs text-slate-400"
              >
                {{ firstName(s.name) }}: {{ s.score }}
              </span>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full bg-green-900/30 px-2.5 py-1 text-sm font-bold text-green-400"
          >
            {{ movie.average.toFixed(1) }}
          </span>
        </div>
      </div>
    </WidgetShell>

    <WidgetShell title="Most Divisive" outer-class="w-full">
      <div class="space-y-2">
        <div
          v-for="movie in consensus.mostDivisive"
          :key="movie.title"
          class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2.5"
        >
          <img
            v-if="movie.imageUrl"
            :src="movie.imageUrl"
            :alt="movie.title"
            class="h-14 w-10 shrink-0 rounded object-cover"
          />
          <div
            v-else
            class="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
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
            <div class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="s in movie.scores"
                :key="s.name"
                class="rounded bg-slate-700/40 px-1.5 py-0.5 text-xs text-slate-400"
              >
                {{ firstName(s.name) }}: {{ s.score }}
              </span>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full bg-red-900/30 px-2.5 py-1 text-sm font-bold text-red-400"
          >
            {{ movie.average.toFixed(1) }}
          </span>
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
