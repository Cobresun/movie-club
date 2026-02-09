<template>
  <div
    v-if="tasteSimilarity.mostSimilar || tasteSimilarity.leastSimilar"
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <WidgetShell
      v-if="tasteSimilarity.mostSimilar"
      title="Most Similar Taste"
      outer-class="w-full"
    >
      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar
            :src="tasteSimilarity.mostSimilar.memberA.image"
            :name="tasteSimilarity.mostSimilar.memberA.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(tasteSimilarity.mostSimilar.memberA.name)
          }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold text-green-400"
            >{{ tasteSimilarity.mostSimilar.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar
            :src="tasteSimilarity.mostSimilar.memberB.image"
            :name="tasteSimilarity.mostSimilar.memberB.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(tasteSimilarity.mostSimilar.memberB.name)
          }}</span>
        </div>
      </div>

      <div
        class="mb-3 rounded bg-green-900/20 px-3 py-2 text-sm text-slate-300"
      >
        Average score difference:
        <span class="font-semibold text-green-300">{{
          tasteSimilarity.mostSimilar.avgDifference
        }}</span>
        points
      </div>

      <div v-if="tasteSimilarity.mostSimilar.bestAgreements.length > 0">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Top agreements
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in tasteSimilarity.mostSimilar.bestAgreements"
            :key="movie.title"
            class="flex items-center justify-between text-sm"
          >
            <span class="truncate text-slate-300" :title="movie.title">{{
              movie.title
            }}</span>
            <span class="ml-2 shrink-0 text-xs text-slate-400">
              {{ movie.scoreA }} vs {{ movie.scoreB }}
            </span>
          </li>
        </ul>
      </div>
    </WidgetShell>

    <WidgetShell
      v-if="tasteSimilarity.leastSimilar"
      title="Least Similar Taste"
      outer-class="w-full"
    >
      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar
            :src="tasteSimilarity.leastSimilar.memberA.image"
            :name="tasteSimilarity.leastSimilar.memberA.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(tasteSimilarity.leastSimilar.memberA.name)
          }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold text-red-400"
            >{{ tasteSimilarity.leastSimilar.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar
            :src="tasteSimilarity.leastSimilar.memberB.image"
            :name="tasteSimilarity.leastSimilar.memberB.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(tasteSimilarity.leastSimilar.memberB.name)
          }}</span>
        </div>
      </div>

      <div class="mb-3 rounded bg-red-900/20 px-3 py-2 text-sm text-slate-300">
        Average score difference:
        <span class="font-semibold text-red-300">{{
          tasteSimilarity.leastSimilar.avgDifference
        }}</span>
        points
      </div>

      <div v-if="tasteSimilarity.leastSimilar.worstAgreements.length > 0">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Biggest disagreements
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in tasteSimilarity.leastSimilar.worstAgreements"
            :key="movie.title"
            class="flex items-center justify-between text-sm"
          >
            <span class="truncate text-slate-300" :title="movie.title">{{
              movie.title
            }}</span>
            <span class="ml-2 shrink-0 text-xs text-slate-400">
              {{ movie.scoreA }} vs {{ movie.scoreB }}
            </span>
          </li>
        </ul>
      </div>
    </WidgetShell>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { computeTasteSimilarity } from "../statsComputers";
import type { MovieData } from "../types";

const props = defineProps<{
  movieData: MovieData[];
  members: Member[];
}>();

const tasteSimilarity = computed(() =>
  computeTasteSimilarity(props.movieData, props.members),
);

function firstName(name: string): string {
  return name.split(" ")[0];
}
</script>
