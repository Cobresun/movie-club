<template>
  <router-link
    v-if="isDefined(missed)"
    :to="puzzlePath(dailyGame, missed.date)"
    class="text-highlight inline-flex items-center gap-1 text-sm font-semibold hover:underline"
  >
    <mdicon name="history" :size="18" aria-hidden="true" />
    Catch up on #{{ missed.puzzle }} from {{ formatPuzzleDate(missed.date) }}
  </router-link>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { type DailyGameConfig } from "@/common/clubType";
import { puzzlePath } from "@/features/daily-game/archive";
import { formatPuzzleDate } from "@/features/daily-game/game";
import { dailyGameProgress } from "@/features/daily-game/useDailyGame";
import { useDailyGameArchive } from "@/service/useDailyGame";

const { clubType, dailyGame, today, current } = defineProps<{
  clubType: ClubType;
  dailyGame: DailyGameConfig;
  /** The player's own date, `YYYY-MM-DD`. */
  today: string;
  /** The puzzle just finished, which is never the one to catch up on. */
  current: string;
}>();

const { data } = useDailyGameArchive(clubType);

// Read once: the link only shows once the open puzzle is finished, and the
// open puzzle is never offered.
const progress = dailyGameProgress(clubType);

// The newest past day the player hasn't finished. Today has its own link.
const missed = computed(() =>
  data.value?.puzzles.find(
    ({ date }) =>
      date < today &&
      date !== current &&
      progress.get(date) !== "solved" &&
      progress.get(date) !== "gaveUp",
  ),
);
</script>
