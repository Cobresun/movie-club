<template>
  <div class="mx-auto max-w-2xl px-4 pt-2 pb-16">
    <empty-state
      v-if="!isDefined(dailyGame)"
      title="There's no daily game here"
      description="This club type doesn't have a daily game yet."
    />
    <div v-else-if="isLoading" class="flex justify-center py-16">
      <loading-spinner />
    </div>
    <empty-state
      v-else-if="isError"
      :title="
        notEnoughWorks ? `${dailyGame.name} is still warming up` : `Couldn't load today's ${noun}`
      "
      :description="
        notEnoughWorks
          ? `Today's ${noun} list is still being put together. Check back in a little while.`
          : 'Something went wrong fetching the puzzle. Give it another try in a moment.'
      "
    />
    <DailyGameBoard
      v-else-if="isDefined(data)"
      :key="data.date"
      :puzzle="data"
      :daily-game="dailyGame"
      :noun="noun"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig } from "@/common/clubType";
import DailyGameBoard from "@/features/daily-game/components/DailyGameBoard.vue";
import { localDate } from "@/features/daily-game/game";
import { useDailyGamePuzzle } from "@/service/useDailyGame";

const { clubType } = defineProps<{ clubType: ClubType }>();

const { noun, dailyGame } = clubTypeConfig(clubType);

const { data, isLoading, isError, error } = useDailyGamePuzzle(clubType, localDate(new Date()));

const notEnoughWorks = computed(() => error.value?.response?.status === 404);
</script>
