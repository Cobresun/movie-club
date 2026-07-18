<template>
  <div>
    <div class="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
      <button
        class="flex flex-col items-center gap-2 rounded-lg bg-lowBackground p-6 text-center transition hover:brightness-110"
        @click="showLog = true"
      >
        <mdicon name="movie-open-outline" :size="40" class="text-highlight" />
        <h3 class="text-lg font-bold text-white">Track your first movie</h3>
        <p class="text-sm text-gray-400">
          Log a watch to start your library — no club required.
        </p>
      </button>

      <router-link
        :to="{ name: 'NewClub' }"
        class="flex flex-col items-center gap-2 rounded-lg bg-lowBackground p-6 text-center transition hover:brightness-110"
      >
        <mdicon
          name="account-multiple-plus"
          :size="40"
          class="text-highlight"
        />
        <h3 class="text-lg font-bold text-white">Create or join a club</h3>
        <p class="text-sm text-gray-400">
          Watch and rate together with friends.
        </p>
      </router-link>
    </div>

    <LogWatchModal v-if="showLog" @close="showLog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import LogWatchModal from "./LogWatchModal.vue";

const showLog = ref(false);
</script>
