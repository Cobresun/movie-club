<template>
  <ol class="flex flex-1 flex-col justify-center gap-4">
    <li v-for="(work, index) in works" :key="work.id" class="flex items-center gap-3">
      <span class="w-5 shrink-0 text-2xl font-bold text-white/60">{{ index + 1 }}</span>
      <img
        v-if="hasValue(work.imageUrl)"
        :src="work.imageUrl"
        :alt="work.title"
        class="h-24 w-16 shrink-0 rounded-md object-cover shadow-lg"
      />
      <div v-else class="h-24 w-16 shrink-0 rounded-md bg-white/10" />
      <p class="line-clamp-3 min-w-0 flex-1 text-lg font-semibold leading-tight">
        {{ work.title }}
      </p>
      <p class="flex shrink-0 flex-col items-end">
        <span class="text-3xl font-bold tabular-nums">{{ work.average.toFixed(1) }}</span>
        <span class="text-[10px] font-semibold uppercase tracking-widest text-white/60">avg</span>
      </p>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { hasValue } from "../../../../../lib/checks/checks.js";

defineProps<{
  works: { id: string; title: string; imageUrl: string | undefined; average: number }[];
}>();
</script>
