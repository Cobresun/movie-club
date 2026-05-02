<template>
  <div class="relative min-h-screen p-6 pb-24">
    <loading-spinner v-if="isLoading" />
    <div v-else-if="error" class="rounded-lg bg-red-900/50 p-4">
      <p class="text-center text-red-400">Failed to load list</p>
    </div>
    <div v-else class="mx-auto max-w-6xl space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-white">
          {{ club?.clubName ?? clubSlug }}
        </h1>
        <p class="mt-1 text-gray-400">{{ listTitle }}</p>
      </div>

      <EmptyState
        v-if="!hasElements(sortedItems)"
        title="List is Empty"
        description="This list has no movies yet."
      />

      <div v-else class="grid grid-cols-auto justify-items-center">
        <div v-for="item in sortedItems" :key="item.id" class="relative">
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
          />
        </div>
      </div>
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { hasElements } from "../../../../lib/checks/checks.js";

import EmptyState from "@/common/components/EmptyState.vue";
import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import { useClub } from "@/service/useClub";
import { useClubLists, useList, useNextWork } from "@/service/useList";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;
const listId = route.params.listId as string;

const { data: club } = useClub(clubSlug);
const { data: lists } = useClubLists(clubSlug, { includeSystem: true });
const { data: items, isLoading, error } = useList(clubSlug, listId);
const { data: nextWorkId } = useNextWork(clubSlug);

const listTitle = computed(
  () => lists.value?.find((l) => l.id === listId)?.title ?? "List",
);

const sortedItems = computed(() => {
  const list = items.value ?? [];
  const next = list.find((i) => i.id === nextWorkId.value);
  return next ? [next, ...list.filter((i) => i.id !== next.id)] : list;
});
</script>
