<template>
  <div
    class="flex h-full w-full flex-col overflow-hidden bg-gradient-to-br p-6 text-left text-white"
    :class="{
      'from-violet-600 via-fuchsia-800 to-slate-900': tone === 'violet',
      'from-primary via-blue-800 to-slate-900': tone === 'blue',
      'from-emerald-500 via-teal-800 to-slate-900': tone === 'emerald',
      'from-rose-500 via-rose-800 to-slate-900': tone === 'rose',
      'from-amber-500 via-orange-700 to-slate-900': tone === 'amber',
      'from-sky-500 via-indigo-800 to-slate-900': tone === 'sky',
    }"
  >
    <div
      class="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-widest text-white/70"
    >
      <span class="truncate">{{ clubName }}</span>
      <span class="shrink-0">Wrapped {{ year }}</span>
    </div>
    <h2 class="mt-5 text-sm font-bold uppercase tracking-widest text-white/90">{{ title }}</h2>
    <div class="mt-4 flex min-h-0 flex-1 flex-col">
      <slot />
    </div>
    <p class="mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/50">Movie Club</p>
  </div>
</template>

<script setup lang="ts">
import type { WrappedTone } from "../wrappedDeck";

defineProps<{
  tone: WrappedTone;
  title: string;
  clubName: string;
  year: number;
}>();
</script>
