<template>
  <!-- Mirrors AdminDashboardView card for card — pulse tiles, the trends
       chart, the four leaderboards, then health — so nothing shifts when the
       numbers land. The range picker above stays live while this shows. -->
  <div class="mx-auto mt-4 w-11/12 max-w-6xl space-y-4" role="status" aria-label="Loading metrics">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div
        v-for="i in 6"
        :key="i"
        class="flex flex-col gap-2.5 rounded-xl bg-lowBackground p-3.5 sm:p-4"
        :style="{ '--skeleton-index': i - 1 }"
      >
        <SkeletonBlock class="h-3 w-20 rounded" />
        <SkeletonBlock class="h-7 w-12 rounded sm:h-8" />
        <SkeletonBlock class="h-3 w-28 max-w-full rounded" />
      </div>
    </div>

    <div class="rounded-xl bg-lowBackground p-4 sm:p-5" :style="{ '--skeleton-index': 2 }">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SkeletonBlock class="h-6 w-24 rounded" />
        <SkeletonBlock class="h-9 w-52 rounded-full" />
      </div>
      <SkeletonBlock class="mb-5 h-4 w-72 max-w-full rounded" />
      <!-- Bars rather than a flat slab, so the placeholder already reads as
           a chart. Heights are fixed rather than random so every load looks
           the same. -->
      <div class="flex h-48 items-end gap-1.5 sm:h-64 sm:gap-2.5">
        <SkeletonBlock
          v-for="(height, i) in BAR_HEIGHTS"
          :key="i"
          class="flex-1 rounded-t"
          :class="{ 'hidden sm:block': i % 2 === 1 }"
          :style="{ height: `${height}%` }"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div
        v-for="(card, i) in LIST_CARDS"
        :key="i"
        class="rounded-xl bg-lowBackground p-4 sm:p-5"
        :style="{ '--skeleton-index': i + 3 }"
      >
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock class="h-6 w-40 rounded" />
          <SkeletonBlock v-if="card.tabs" class="h-9 w-40 rounded-full" />
        </div>
        <div class="divide-y divide-slate-700/40">
          <div v-for="row in 4" :key="row" class="flex items-center gap-3 py-2.5">
            <SkeletonBlock
              v-if="card.leading === 'poster'"
              class="aspect-[2/3] w-9 shrink-0 rounded"
            />
            <SkeletonBlock v-else class="size-8 shrink-0 rounded-full" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <SkeletonBlock
                class="h-3.5 max-w-full rounded"
                :class="LINE_WIDTHS[(row + i) % LINE_WIDTHS.length]"
              />
              <SkeletonBlock class="h-3 w-28 max-w-full rounded" />
            </div>
            <SkeletonBlock class="h-7 w-11 shrink-0 rounded-full" />
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-3 pt-4" :style="{ '--skeleton-index': 7 }">
      <SkeletonBlock class="h-4 w-16 rounded" />
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          v-for="i in 3"
          :key="i"
          class="flex items-center gap-4 rounded-xl bg-lowBackground p-3.5 sm:flex-col sm:items-start sm:gap-2 sm:p-4"
        >
          <SkeletonBlock class="h-7 w-14 shrink-0 rounded sm:order-2" />
          <div class="flex flex-1 flex-col gap-2 sm:contents">
            <SkeletonBlock class="h-3 w-24 rounded sm:order-1" />
            <SkeletonBlock class="h-3 w-36 max-w-full rounded sm:order-3" />
          </div>
        </div>
      </div>
      <div class="rounded-xl bg-lowBackground p-4 sm:p-5">
        <SkeletonBlock class="h-6 w-44 rounded" />
        <SkeletonBlock class="mt-2 h-3.5 w-72 max-w-full rounded" />
        <SkeletonBlock class="mt-4 h-3 w-full rounded-full" />
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SkeletonBlock v-for="i in 4" :key="i" class="h-4 w-28 max-w-full rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";

const BAR_HEIGHTS = [38, 62, 24, 80, 46, 30, 68, 52, 88, 34, 58, 42, 72, 28];

const LINE_WIDTHS = ["w-40", "w-32", "w-48", "w-36"];

const LIST_CARDS = [
  { leading: "poster", tabs: true },
  { leading: "avatar", tabs: false },
  { leading: "avatar", tabs: true },
  { leading: "avatar", tabs: true },
] as const;
</script>
