<template>
  <div v-if="!isLoggedIn">
    <div class="h-20" />
    <div
      class="fixed inset-x-0 bottom-0 px-4 pb-4 transition-transform duration-slow ease-emphasized"
      :class="{ 'translate-y-[150%]': isHidden }"
    >
      <div
        class="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-xl border border-slate-700 bg-gradient-to-r from-secondary to-lowBackground px-5 py-3 shadow-lg"
      >
        <div class="text-left">
          <div class="flex items-center gap-1.5 text-highlight">
            <span aria-hidden="true">🍿</span>
            <span class="text-sm font-semibold tracking-wide">MovieClub</span>
          </div>
          <h2 class="mt-1 text-lg font-bold leading-tight text-white">Join the Club!</h2>
          <p class="text-xs text-gray-200">Rate movies and compare favorites with your friends.</p>
        </div>
        <a
          href="/"
          class="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-bold tracking-wide text-white transition hover:brightness-110 active:brightness-105"
        >
          Sign Up
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { useHideOnScroll } from "../composables/useHideOnScroll";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { isHidden } = useHideOnScroll({ revealOffset: 50 });
</script>
