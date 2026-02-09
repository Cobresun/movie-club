<template>
  <div
    v-if="mostSimilar || leastSimilar"
    class="mx-auto grid w-11/12 grid-cols-1 gap-6 md:grid-cols-2"
  >
    <div v-if="mostSimilar" class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-1 text-lg font-bold text-white">Most Similar Taste</h3>
      <p class="mb-4 text-sm text-slate-400">
        Based on {{ mostSimilar.sharedCount }} movies reviewed in common
      </p>

      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar
            :src="mostSimilar.memberA.image"
            :name="mostSimilar.memberA.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(mostSimilar.memberA.name)
          }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold text-green-400"
            >{{ mostSimilar.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar
            :src="mostSimilar.memberB.image"
            :name="mostSimilar.memberB.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(mostSimilar.memberB.name)
          }}</span>
        </div>
      </div>

      <div
        class="mb-3 rounded bg-green-900/20 px-3 py-2 text-sm text-slate-300"
      >
        Average score difference:
        <span class="font-semibold text-green-300">{{
          mostSimilar.avgDifference
        }}</span>
        points
      </div>

      <div v-if="mostSimilar.bestAgreements.length > 0">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Top agreements
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in mostSimilar.bestAgreements"
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
    </div>

    <div v-if="leastSimilar" class="rounded-lg bg-lowBackground p-5">
      <h3 class="mb-1 text-lg font-bold text-white">Least Similar Taste</h3>
      <p class="mb-4 text-sm text-slate-400">
        Based on {{ leastSimilar.sharedCount }} movies reviewed in common
      </p>

      <div class="mb-4 flex items-center justify-center gap-3">
        <div class="flex flex-col items-center">
          <v-avatar
            :src="leastSimilar.memberA.image"
            :name="leastSimilar.memberA.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(leastSimilar.memberA.name)
          }}</span>
        </div>
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-bold text-red-400"
            >{{ leastSimilar.similarityPercent }}%</span
          >
          <span class="text-xs text-slate-400">similar</span>
        </div>
        <div class="flex flex-col items-center">
          <v-avatar
            :src="leastSimilar.memberB.image"
            :name="leastSimilar.memberB.name"
            :size="48"
          />
          <span class="mt-1 text-xs text-slate-300">{{
            firstName(leastSimilar.memberB.name)
          }}</span>
        </div>
      </div>

      <div class="mb-3 rounded bg-red-900/20 px-3 py-2 text-sm text-slate-300">
        Average score difference:
        <span class="font-semibold text-red-300">{{
          leastSimilar.avgDifference
        }}</span>
        points
      </div>

      <div v-if="leastSimilar.worstAgreements.length > 0">
        <p
          class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          Biggest disagreements
        </p>
        <ul class="space-y-1">
          <li
            v-for="movie in leastSimilar.worstAgreements"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MemberPairSimilarity } from "../StatisticsUtils";

defineProps<{
  mostSimilar: MemberPairSimilarity | null;
  leastSimilar: MemberPairSimilarity | null;
}>();

function firstName(name: string): string {
  return name.split(" ")[0];
}
</script>
