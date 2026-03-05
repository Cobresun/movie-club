<template>
  <h3 class="mb-5 text-center text-lg font-semibold text-white">
    {{ title }}
  </h3>

  <div class="space-y-3">
    <div
      v-for="(entry, index) in entries"
      :key="entry.name"
      class="overflow-hidden rounded-lg border border-slate-700/30 bg-background/50 px-4 py-3 transition-colors hover:border-slate-600/50 hover:bg-background/80"
    >
      <div
        role="button"
        tabindex="0"
        :aria-expanded="expanded.has(index)"
        class="flex cursor-pointer items-center gap-4"
        @click="toggle(index)"
        @keydown.enter="toggle(index)"
        @keydown.space.prevent="toggle(index)"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          :class="rankClass(index)"
        >
          {{ index + 1 }}
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate font-medium text-white">
              {{ entry.name }}
            </span>
            <div class="flex shrink-0 items-center gap-3">
              <span class="text-xs text-slate-400">
                {{ entry.movieCount }}
                {{ entry.movieCount === 1 ? "film" : "films" }}
              </span>
              <span
                class="min-w-[2.5rem] text-right text-sm font-semibold"
                :class="scoreColor(entry.averageScore)"
              >
                {{ entry.averageScore.toFixed(1) }}
              </span>
              <mdicon
                :name="expanded.has(index) ? 'chevron-up' : 'chevron-down'"
                size="18"
                class="text-slate-500"
              />
            </div>
          </div>

          <div
            class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50"
          >
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="barColor(entry.averageScore)"
              :style="{ width: barWidth(entry.averageScore) + '%' }"
            />
          </div>
        </div>
      </div>

      <div v-if="expanded.has(index)" class="mt-2 flex flex-wrap gap-1 pl-12">
        <span
          v-for="movie in entry.movies"
          :key="movie"
          class="inline-block max-w-[10rem] truncate rounded bg-slate-700/40 px-1.5 py-0.5 text-[0.65rem] text-slate-400"
        >
          {{ movie }}
        </span>
      </div>
    </div>
  </div>

  <p
    v-if="entries.length === 0"
    class="py-4 text-center text-sm text-slate-500"
  >
    {{ emptyMessage }}
  </p>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { PersonStats } from "../statsComputers";

defineProps<{
  title: string;
  entries: PersonStats[];
  emptyMessage: string;
}>();

const expanded = ref(new Set<number>());

function toggle(index: number): void {
  const next = new Set(expanded.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    next.add(index);
  }
  expanded.value = next;
}

function rankClass(index: number): string {
  switch (index) {
    case 0:
      return "bg-amber-500/20 text-amber-400";
    case 1:
      return "bg-slate-400/20 text-slate-300";
    case 2:
      return "bg-orange-600/20 text-orange-400";
    default:
      return "bg-slate-600/20 text-slate-400";
  }
}

function scoreColor(score: number): string {
  if (score >= 7.5) return "text-emerald-400";
  if (score >= 5) return "text-primary";
  return "text-orange-400";
}

function barColor(score: number): string {
  if (score >= 7.5) return "bg-emerald-500/70";
  if (score >= 5) return "bg-primary/70";
  return "bg-orange-500/70";
}

function barWidth(score: number): number {
  return (score / 10) * 100;
}
</script>
