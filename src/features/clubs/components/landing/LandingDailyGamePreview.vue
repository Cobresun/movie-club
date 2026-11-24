<template>
  <TabGroup :selected-index="selected" @change="(index: number) => (selected = index)">
    <section
      :aria-labelledby="headingId"
      class="bg-secondary mx-auto flex max-w-6xl flex-col items-center gap-10 rounded-3xl p-6 sm:p-10 lg:flex-row lg:p-14"
    >
      <div
        class="flex flex-col items-center gap-4 text-center lg:w-2/5 lg:items-start lg:text-left"
      >
        <p class="text-sm font-semibold tracking-widest text-blue-100 uppercase">Free daily game</p>
        <h2 :id="headingId" class="text-4xl font-extrabold md:text-5xl">{{ DAILY_GAME_NAME }}</h2>
        <TabList class="bg-background/40 flex gap-1 rounded-full p-1">
          <Tab
            v-for="game in games"
            :key="game.path"
            v-slot="{ selected: isSelected }"
            as="template"
          >
            <button
              class="duration-fast ease-standard rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              :class="isSelected ? 'bg-text text-background' : 'text-blue-50 hover:text-white'"
            >
              {{ game.mode }}
            </button>
          </Tab>
        </TabList>
        <p class="text-lg leading-relaxed text-blue-50">{{ current.tagline }}</p>
        <router-link
          :to="current.path"
          class="bg-text text-background rounded-md px-5 py-3 text-lg font-bold tracking-wide transition hover:brightness-90"
        >
          Play today’s {{ current.noun }}
        </router-link>
      </div>
      <TabPanels class="bg-background flex w-full flex-col gap-2 rounded-2xl p-4 lg:w-3/5">
        <TabPanel v-for="game in games" :key="game.path" class="flex flex-col gap-2">
          <p class="text-left text-sm text-gray-400">Sample guesses, closest first</p>
          <ol class="flex flex-col gap-2">
            <GuessRow v-for="guess in samples(game)" :key="guess.work.id" :guess="guess" />
          </ol>
        </TabPanel>
      </TabPanels>
    </section>
  </TabGroup>
</template>

<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/vue";
import { computed, ref, useId } from "vue";

import { DAILY_GAME_NAME, type DailyGameConfig } from "@/common/clubType";
import GuessRow from "@/features/daily-game/components/GuessRow.vue";
import { rankGuess } from "@/features/daily-game/useDailyGame";

const { games } = defineProps<{
  /** Every mode of the game, the first shown first. */
  games: readonly [DailyGameConfig, ...DailyGameConfig[]];
}>();

const headingId = useId();
const selected = ref(0);
const current = computed(() => games[selected.value] ?? games[0]);

const samples = (game: DailyGameConfig) =>
  game.preview.guesses.map((work) => rankGuess(work, game.preview.poolSize, false));
</script>
