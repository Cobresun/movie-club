<template>
  <div class="flex flex-1 flex-col justify-center">
    <div class="flex items-center gap-4">
      <img
        v-if="hasValue(imageUrl)"
        :src="imageUrl"
        :alt="title"
        class="h-36 w-24 shrink-0 rounded-lg object-cover shadow-lg"
      />
      <div class="min-w-0">
        <p class="line-clamp-3 text-2xl font-bold leading-tight">{{ title }}</p>
        <p class="mt-2 text-sm text-white/80">
          ±{{ spread.toFixed(1) }} spread · {{ average.toFixed(1) }} avg
        </p>
      </div>
    </div>
    <ul class="mt-6 flex flex-col gap-2.5">
      <li v-for="entry in shownScores" :key="entry.name" class="flex items-center gap-3 text-sm">
        <span class="w-20 shrink-0 truncate font-medium">{{ firstName(entry.name) }}</span>
        <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div class="h-full rounded-full bg-white" :style="{ width: `${entry.score * 10}%` }" />
        </div>
        <span class="w-8 shrink-0 text-right font-bold tabular-nums">{{ entry.score }}</span>
      </li>
    </ul>
    <p v-if="hiddenCount > 0" class="mt-2 text-xs text-white/70">+{{ hiddenCount }} more</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../../../lib/checks/checks.js";
import { firstName } from "@/common/memberName";

const MAX_SCORES = 8;

const props = defineProps<{
  title: string;
  imageUrl: string | undefined;
  average: number;
  spread: number;
  scores: { name: string; score: number }[];
}>();

const shownScores = computed(() => props.scores.slice(0, MAX_SCORES));
const hiddenCount = computed(() => props.scores.length - shownScores.value.length);
</script>
