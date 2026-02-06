<template>
  <div class="flex min-h-[60vh] items-center justify-center p-8">
    <div
      class="w-full max-w-md rounded-lg bg-lowBackground p-8 text-center shadow-lg"
    >
      <div class="space-y-4">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-900/50"
        >
          <mdicon name="ticket-outline" size="32" class="text-amber-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Club Not Found</h1>
        <p class="text-lg font-semibold text-amber-400">Members Only</p>
        <p class="text-gray-300">
          This club doesn't exist or you don't have access. You'll need an
          invitation to join a private club.
        </p>
        <v-btn class="mt-4" @click="goHome">Browse Your Clubs</v-btn>
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
