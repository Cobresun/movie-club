<template>
  <div class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2">
    <WidgetShell
      outer-class="w-full"
      inner-class="rounded-xl border border-slate-700/50 bg-lowBackground/60 p-6"
    >
      <PersonLeaderboard
        title="Most Watched Directors"
        :entries="topDirectors"
        empty-message="No director data available yet."
      />
    </WidgetShell>

    <WidgetShell
      outer-class="w-full"
      inner-class="rounded-xl border border-slate-700/50 bg-lowBackground/60 p-6"
    >
      <PersonLeaderboard
        title="Most Watched Actors"
        :entries="topActors"
        empty-message="No actor data available yet."
      />
    </WidgetShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import PersonLeaderboard from "./PersonLeaderboard.vue";
import WidgetShell from "./WidgetShell.vue";
import { computeTopActors, computeTopDirectors } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
}>();

const topDirectors = computed(() => computeTopDirectors(props.movieData));
const topActors = computed(() => computeTopActors(props.movieData));
</script>
