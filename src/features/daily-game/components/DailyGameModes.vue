<template>
  <nav v-if="modes.length > 1" aria-label="Game mode" class="flex justify-center">
    <div class="bg-lowBackground flex gap-1 rounded-full p-1">
      <router-link
        v-for="mode in modes"
        :key="mode.clubType"
        :to="to(mode.dailyGame)"
        :aria-current="mode.clubType === current ? 'page' : undefined"
        class="duration-fast ease-standard rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
        :class="
          mode.clubType === current ? 'bg-primary text-white' : 'text-white/70 hover:text-white'
        "
      >
        {{ mode.dailyGame.mode }}
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { isDefined } from "@/../lib/checks/checks";
import { type ClubType } from "@/../lib/types/generated/db";
import { clubTypeConfig, type DailyGameConfig, dailyGameClubTypes } from "@/common/clubType";

const { current, to } = defineProps<{
  current: ClubType;
  /** Where each mode's link goes: its puzzle, or its archive. */
  to: (dailyGame: DailyGameConfig) => string;
}>();

const modes = dailyGameClubTypes().flatMap((clubType) => {
  const { dailyGame } = clubTypeConfig(clubType);
  return isDefined(dailyGame) ? [{ clubType, dailyGame }] : [];
});
</script>
