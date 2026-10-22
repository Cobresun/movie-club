<template>
  <div class="mx-auto max-w-2xl px-4 pb-16 pt-2">
    <div v-if="isLoading" class="flex justify-center py-16">
      <loading-spinner />
    </div>
    <empty-state
      v-else-if="isError"
      :title="notEnoughMovies ? 'Closer is still warming up' : 'Couldn\'t load today\'s movie'"
      :description="
        notEnoughMovies
          ? 'The daily game draws from the movies clubs add to Movie Club. Check back once a few more are in.'
          : 'Something went wrong fetching the puzzle. Give it another try in a moment.'
      "
    />
    <DailyGameBoard v-else-if="isDefined(data)" :key="data.date" :puzzle="data" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "@/../lib/checks/checks";
import DailyGameBoard from "@/features/daily-game/components/DailyGameBoard.vue";
import { localDate } from "@/features/daily-game/game";
import { useDailyGamePuzzle } from "@/service/useDailyGame";

const { data, isLoading, isError, error } = useDailyGamePuzzle(localDate(new Date()));

const notEnoughMovies = computed(() => error.value?.response?.status === 404);
</script>
