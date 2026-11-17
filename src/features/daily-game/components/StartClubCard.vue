<template>
  <section
    v-if="!isLoggedIn"
    aria-labelledby="daily-game-club"
    class="bg-lowBackground animate-fade-up flex flex-col items-center gap-3 rounded-xl p-6 text-center"
  >
    <mdicon name="account-group-outline" :size="32" class="text-highlight" />
    <h2 id="daily-game-club" class="text-lg leading-tight font-bold">
      {{ dailyGame.clubPitch.heading }}
    </h2>
    <p class="text-sm text-white/70">{{ dailyGame.clubPitch.body }}</p>
    <a
      :href="startClubUrl(dailyGame.path)"
      class="bg-primary mt-1 flex min-h-[44px] items-center rounded-md px-5 text-sm font-bold tracking-wide text-white transition hover:brightness-110 active:brightness-105"
      @click="emit('start')"
    >
      Start your own club
    </a>
    <p class="text-xs text-white/50">It's free.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { type DailyGameConfig } from "@/common/clubType";
import { startClubUrl } from "@/features/daily-game/game";
import { useAuthStore } from "@/stores/auth";

const { dailyGame } = defineProps<{ dailyGame: DailyGameConfig }>();

const emit = defineEmits<{ start: [] }>();

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);
</script>
