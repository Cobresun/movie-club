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
      v-else-if="isError && isDefined(date) && notFound"
      :title="`There's no ${dailyGame.name} for ${formatPuzzleDate(date)}`"
      description="Pick another day from the archive."
      action-label="Past puzzles"
      action-icon="history"
      @action="router.push(archivePath(dailyGame))"
    />
    <empty-state
      v-else-if="isError"
      :title="
        notFound
          ? `${dailyGame.name} is still warming up`
          : `Couldn't load ${isDefined(date) ? 'this' : 'today\'s'} ${noun}`
      "
      :description="
        notFound
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
      :today="today"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig } from "@/common/clubType";
import { archivePath } from "@/features/daily-game/archive";
import DailyGameBoard from "@/features/daily-game/components/DailyGameBoard.vue";
import { formatPuzzleDate, localDate } from "@/features/daily-game/game";
import { useDailyGamePuzzle } from "@/service/useDailyGame";

const { clubType, date = undefined } = defineProps<{
  clubType: ClubType;
  /** A past day's puzzle, `YYYY-MM-DD`, played from the archive. Today's when absent. */
  date?: string;
}>();

const { noun, dailyGame } = clubTypeConfig(clubType);
const router = useRouter();

const today = localDate(new Date());

const { data, isLoading, isError, error } = useDailyGamePuzzle(clubType, () => date ?? today);

// Today's puzzle is missing only while the catalog is too small to play; a
// past one, when that day never had a puzzle.
const notFound = computed(() => error.value?.response?.status === 404);
</script>
