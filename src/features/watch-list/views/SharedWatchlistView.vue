<template>
  <div class="relative min-h-screen p-6 pb-24">
    <loading-spinner v-if="isLoading" />
    <div v-else-if="error" class="rounded-lg bg-red-900/50 p-4">
      <p class="text-center text-red-400">Failed to load watchlist</p>
    </div>
    <div v-else class="mx-auto max-w-6xl space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-white">
          {{ club?.clubName ?? clubSlug }}
        </h1>
        <p class="mt-1 text-gray-400">Watch List</p>
      </div>

      <EmptyState
        v-if="!hasElements(sortedWatchList)"
        title="Watch List is Empty"
        description="This club hasn't added any movies to their watch list yet."
      />

      <div
        v-else
        class="grid grid-cols-2 justify-items-center gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        <div
          v-for="(item, index) in sortedWatchList"
          :key="item.id"
          class="relative"
        >
          <div
            v-if="item.id === nextWorkId"
            class="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-highlightBackground px-3 py-0.5 text-xs font-semibold text-white shadow"
          >
            Next Watch
          </div>
          <MoviePosterCard
            :movie-title="item.title"
            :movie-poster-url="item.imageUrl ?? ''"
            :highlighted="item.id === nextWorkId"
          >
            <p class="text-center text-xs text-gray-400">#{{ index + 1 }}</p>
          </MoviePosterCard>
        </div>
      </div>
    </div>

    <!-- Fixed Call-to-Action Banner -->
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";

import { hasElements } from "../../../../lib/checks/checks.js";
import { WorkListType } from "../../../../lib/types/generated/db.js";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { useClub } from "@/service/useClub";
import { useList, useNextWork } from "@/service/useList";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { data: club } = useClub(clubSlug);
const { data: watchList, isLoading, error } = useList(clubSlug, WorkListType.watchlist);
const { data: nextWorkId } = useNextWork(clubSlug);

const sortedWatchList = computed(() => {
  const list = watchList.value ?? [];
  const nextItem = list.find((item) => item.id === nextWorkId.value);
  if (nextItem) {
    return [nextItem, ...list.filter((item) => item.id !== nextItem.id)];
  }
  return list;
});

// Scroll behavior for floating CTA bar
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
