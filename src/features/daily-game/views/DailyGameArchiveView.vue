<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-2 pb-16 text-left">
    <empty-state
      v-if="!isDefined(dailyGame)"
      title="There's no daily game here"
      description="This club type doesn't have a daily game yet."
    />
    <template v-else>
      <header class="text-center">
        <h1 class="text-3xl font-bold sm:text-4xl">{{ dailyGame.name }} archive</h1>
        <p class="mt-2 text-white/70">
          Missed a day? Every past {{ noun }} is still here to guess.
        </p>
        <nav aria-label="Other puzzles" class="mt-3 flex justify-center text-sm">
          <router-link
            :to="dailyGame.path"
            class="text-highlight inline-flex items-center gap-1 hover:underline"
          >
            <mdicon name="lightbulb-on-outline" :size="18" />
            Today's puzzle
          </router-link>
        </nav>
      </header>

      <div v-if="isLoading" class="flex justify-center py-16">
        <loading-spinner />
      </div>
      <empty-state
        v-else-if="isError"
        title="Couldn't load the archive"
        description="Something went wrong fetching past puzzles. Give it another try in a moment."
      />
      <empty-state
        v-else-if="!hasElements(puzzles)"
        title="No puzzles yet"
        :description="`The first ${dailyGame.name} hasn't been played yet.`"
      />
      <ul v-else class="flex flex-col gap-2" aria-label="Puzzles, newest first">
        <li v-for="entry in puzzles" :key="entry.date">
          <router-link
            :to="entry.date === today ? dailyGame.path : puzzlePath(dailyGame, entry.date)"
            :aria-label="entry.label"
            class="bg-lowBackground duration-fast ease-standard flex items-center justify-between gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-white/10"
          >
            <span class="flex items-baseline gap-3">
              <span class="text-lg font-bold">#{{ entry.puzzle }}</span>
              <span class="text-white/70">{{ formatPuzzleDate(entry.date) }}</span>
              <span
                v-if="entry.date === today"
                class="bg-highlight/20 text-highlight rounded px-1.5 py-0.5 text-xs font-medium"
              >
                Today
              </span>
            </span>
            <span
              v-if="isDefined(entry.progress)"
              class="flex shrink-0 items-center gap-1 text-sm text-white/70"
            >
              <mdicon :name="entry.progress.icon" :size="18" />
              {{ entry.progress.label }}
            </span>
          </router-link>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig } from "@/common/clubType";
import { puzzlePath } from "@/features/daily-game/archive";
import { formatPuzzleDate, localDate } from "@/features/daily-game/game";
import { dailyGameProgress, type DayProgress } from "@/features/daily-game/useDailyGame";
import { useDailyGameArchive } from "@/service/useDailyGame";

const { clubType } = defineProps<{ clubType: ClubType }>();

const { noun, dailyGame } = clubTypeConfig(clubType);

const PROGRESS: Record<DayProgress, { label: string; icon: string }> = {
  solved: { label: "Solved", icon: "check" },
  gaveUp: { label: "Gave up", icon: "flag-outline" },
  started: { label: "In progress", icon: "clock-outline" },
};

const today = localDate(new Date());
const progress = dailyGameProgress(clubType);

const { data, isLoading, isError } = useDailyGameArchive(clubType);

// The server lists up to the furthest-ahead day anywhere; a day still to come
// for this player is not theirs to play yet.
const puzzles = computed(() =>
  (data.value?.puzzles ?? [])
    .filter((entry) => entry.date <= today)
    .map((entry) => {
      const played = progress.get(entry.date);
      const status = isDefined(played) ? PROGRESS[played] : undefined;
      const label = [
        `#${entry.puzzle}`,
        formatPuzzleDate(entry.date),
        entry.date === today ? "Today" : undefined,
        status?.label,
      ].filter(isDefined);
      return { ...entry, progress: status, label: label.join(", ") };
    }),
);
</script>
