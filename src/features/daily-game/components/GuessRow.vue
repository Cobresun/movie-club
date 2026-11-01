<template>
  <li
    :aria-labelledby="titleId"
    class="bg-lowBackground relative overflow-hidden rounded-lg"
    :class="{ 'ring-highlight ring-2': highlighted }"
  >
    <div
      aria-hidden="true"
      class="duration-slow ease-emphasized absolute inset-y-0 left-0 transition-[width]"
      :class="{
        'bg-green-600/40': guess.temperature === 'hot',
        'bg-yellow-500/30': guess.temperature === 'warm',
        'bg-red-500/25': guess.temperature === 'cold',
      }"
      :style="{ width: `${Math.max(4, guess.closeness * 100)}%` }"
    />
    <div class="relative flex flex-col gap-1.5 px-3 py-2 text-left">
      <div class="flex items-baseline justify-between gap-3">
        <p :id="titleId" class="min-w-0 font-semibold">
          {{ guess.work.title }}
          <span v-if="isDefined(guess.work.year)" class="font-normal text-white/60"
            >({{ guess.work.year }})</span
          >
          <span
            v-if="guess.hint"
            class="bg-highlight/20 text-highlight ml-1 rounded px-1.5 py-0.5 text-xs font-medium"
          >
            Hint
          </span>
        </p>
        <p class="shrink-0 text-right whitespace-nowrap">
          <span class="text-xs tracking-wide text-white/60 uppercase">{{ temperatureLabel }}</span>
          <span class="ml-2 text-lg font-bold">#{{ guess.work.rank }}</span>
        </p>
      </div>
      <ul
        v-if="hasElements(guess.work.clues)"
        :aria-label="`What ${guess.work.title} has in common with the answer`"
        class="flex flex-wrap gap-1.5"
      >
        <li
          v-for="clue in guess.work.clues"
          :key="clue"
          class="bg-background/70 rounded-full px-2 py-0.5 text-xs text-white/80"
        >
          {{ clue }}
        </li>
      </ul>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

import { hasElements, isDefined } from "@/../lib/checks/checks";
import { type Temperature } from "@/features/daily-game/game";
import { type RankedGuess } from "@/features/daily-game/useDailyGame";

const { guess, highlighted = false } = defineProps<{
  guess: RankedGuess;
  highlighted?: boolean;
}>();

const titleId = useId();

const TEMPERATURE_LABELS: Record<Temperature, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

const temperatureLabel = computed(() =>
  guess.work.rank === 1 ? "Got it" : TEMPERATURE_LABELS[guess.temperature],
);
</script>
