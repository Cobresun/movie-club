<template>
  <div class="mx-auto flex w-11/12 gap-4 pt-4">
    <div
      class="flex flex-1 items-center gap-4 rounded-xl border border-slate-700 bg-lowBackground px-6 py-5"
    >
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/20"
      >
        <mdicon name="filmstrip" class="text-primary" :size="22" />
      </div>
      <div>
        <p class="text-sm text-slate-400">Movies Watched</p>
        <p class="text-2xl font-semibold text-white">{{ totalMovies }}</p>
      </div>
    </div>
    <div
      class="flex flex-1 items-center gap-4 rounded-xl border border-slate-700 bg-lowBackground px-6 py-5"
    >
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/20"
      >
        <mdicon name="clock-outline" class="text-primary" :size="22" />
      </div>
      <div>
        <p class="text-sm text-slate-400">Total Watch Time</p>
        <p class="text-2xl font-semibold text-white">{{ formattedTime }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  totalMovies: number;
  totalRuntimeMinutes: number;
}>();

const formattedTime = computed(() => {
  const hours = Math.floor(props.totalRuntimeMinutes / 60);
  const minutes = props.totalRuntimeMinutes % 60;
  return `${hours}h ${minutes}m`;
});
</script>
