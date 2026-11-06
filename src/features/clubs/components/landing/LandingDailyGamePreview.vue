<template>
  <section
    :aria-labelledby="headingId"
    class="bg-secondary mx-auto flex max-w-6xl flex-col items-center gap-10 rounded-3xl p-6 sm:p-10 lg:flex-row lg:p-14"
  >
    <div class="flex flex-col items-center gap-4 text-center lg:w-2/5 lg:items-start lg:text-left">
      <p class="text-sm font-semibold tracking-widest text-blue-100 uppercase">
        Free daily {{ noun }} game
      </p>
      <h2 :id="headingId" class="text-4xl font-extrabold md:text-5xl">{{ dailyGame.name }}</h2>
      <p class="text-lg leading-relaxed text-blue-50">{{ dailyGame.tagline }}</p>
      <router-link
        :to="dailyGame.path"
        class="bg-text text-background rounded-md px-5 py-3 text-lg font-bold tracking-wide transition hover:brightness-90"
      >
        Play today’s {{ noun }}
      </router-link>
    </div>
    <div class="bg-background flex w-full flex-col gap-2 rounded-2xl p-4 lg:w-3/5">
      <p class="text-left text-sm text-gray-400">Sample guesses, closest first</p>
      <ol class="flex flex-col gap-2">
        <GuessRow v-for="guess in guesses" :key="guess.work.id" :guess="guess" />
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

import { type DailyGameConfig } from "@/common/clubType";
import GuessRow from "@/features/daily-game/components/GuessRow.vue";
import { rankGuess } from "@/features/daily-game/useDailyGame";

const { dailyGame } = defineProps<{
  dailyGame: DailyGameConfig;
  noun: string;
}>();

const headingId = useId();

const guesses = computed(() =>
  dailyGame.preview.guesses.map((work) => rankGuess(work, dailyGame.preview.poolSize, false)),
);
</script>
