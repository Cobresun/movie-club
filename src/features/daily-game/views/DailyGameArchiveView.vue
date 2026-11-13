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
      <div v-else class="mx-auto flex w-full max-w-md flex-col gap-6">
        <section v-for="month in months" :key="month.key" :aria-labelledby="`month-${month.key}`">
          <h2 :id="`month-${month.key}`" class="mb-2 text-lg font-bold">{{ month.label }}</h2>
          <div class="grid grid-cols-7 gap-1 text-center text-xs text-white/50" aria-hidden="true">
            <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
          </div>
          <ul class="mt-1 grid grid-cols-7 gap-1" :aria-label="month.label">
            <li v-for="blank in month.leadingBlanks" :key="`blank-${blank}`" aria-hidden="true" />
            <li v-for="day in month.days" :key="day.date" :aria-hidden="!isDefined(day.entry)">
              <router-link
                v-if="isDefined(day.entry)"
                :to="day.date === today ? dailyGame.path : puzzlePath(dailyGame, day.date)"
                :aria-label="day.entry.label"
                :aria-current="day.date === today ? 'date' : undefined"
                class="bg-lowBackground duration-fast ease-standard flex aspect-square flex-col items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                :class="day.date === today ? 'ring-highlight ring-2' : undefined"
              >
                <span class="text-sm font-bold sm:text-base">{{ day.day }}</span>
                <mdicon
                  v-if="isDefined(day.entry.progress)"
                  :name="day.entry.progress.icon"
                  :size="16"
                  class="text-highlight"
                />
                <span v-else class="text-xs text-white/50">#{{ day.entry.puzzle }}</span>
              </router-link>
              <span
                v-else
                class="flex aspect-square items-center justify-center text-sm text-white/20"
              >
                {{ day.day }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig } from "@/common/clubType";
import { calendarMonths, puzzlePath } from "@/features/daily-game/archive";
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const months = computed(() => calendarMonths(puzzles.value));
</script>
