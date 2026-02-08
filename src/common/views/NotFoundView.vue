<template>
  <div class="flex min-h-[60vh] items-center justify-center p-8">
    <div
      class="w-full max-w-md rounded-lg bg-lowBackground p-8 text-center shadow-lg"
    >
      <div class="space-y-4">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50"
        >
          <mdicon name="seat-outline" size="32" class="text-slate-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Theater 404</h1>
        <p class="text-lg font-semibold text-slate-400">
          Please exit to the lobby.
        </p>
        <p class="text-gray-300">
          This theater is empty. No film, no fans, not even any spilled popcorn.
          Your movie must be playing somewhere else.
        </p>
        <v-btn class="mt-4" @click="goHome">Exit to Lobby</v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

const goHome = () => {
  router.push({ name: "Clubs" }).catch(console.error);
};
</script>
