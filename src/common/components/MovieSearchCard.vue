<template>
  <button
    class="mb-4 w-32 rounded-lg text-left transition-all duration-100 hover:ring-2 hover:ring-primary"
    @click="emit('select')"
  >
    <div class="flex h-full flex-col rounded-lg bg-slate-700">
      <img
        v-if="hasValue(posterUrl)"
        v-lazy-load
        :src="posterUrl"
        class="rounded-t-lg"
      />
      <div
        v-else
        class="flex h-56 items-center justify-center rounded-t-lg bg-slate-600"
      >
        <mdicon name="movie-outline" :size="48" class="text-slate-400" />
      </div>
      <div
        class="flex flex-grow flex-col items-center justify-center px-2 py-2"
      >
        <h3 class="text-center font-semibold" style="height: min-content">
          {{ title }}
        </h3>
        <p v-if="hasValue(year)" class="text-sm italic text-gray-400">
          {{ year }}
        </p>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { hasValue } from "../../../lib/checks/checks";

defineProps<{
  title: string;
  year: string;
  posterUrl: string;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();
</script>
