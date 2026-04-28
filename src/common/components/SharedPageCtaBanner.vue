<template>
  <div v-if="!isLoggedIn">
    <div class="h-20" />
    <div
      class="fixed inset-x-0 bottom-0 bg-secondary px-4 py-3 shadow-lg transition-transform duration-300"
      :class="{ 'translate-y-full': isScrollingDown }"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div class="text-left">
          <h2 class="text-lg font-bold text-white">Join the Club!</h2>
          <p class="text-xs text-gray-200">
            Join clubs and review movies with your friends.
          </p>
        </div>
        <a
          href="/"
          class="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/80"
        >
          Sign Up
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const isScrollingDown = ref(false);
let lastScrollY = 0;

const handleScroll = () => {
  const currentScrollY = window.scrollY;
  if (currentScrollY > lastScrollY && currentScrollY > 50) {
    isScrollingDown.value = true;
  } else if (currentScrollY < lastScrollY) {
    isScrollingDown.value = false;
  }
  lastScrollY = currentScrollY;
};

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>
