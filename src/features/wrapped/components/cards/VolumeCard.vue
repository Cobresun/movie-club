<template>
  <div class="flex flex-1 flex-col justify-center">
    <mdicon :name="unitIcon" :size="44" class="text-white/80" />
    <p class="mt-4 text-7xl font-bold tabular-nums leading-none tracking-tight">
      {{ value.toLocaleString("en-US") }}
    </p>
    <p class="mt-2 text-3xl font-semibold">{{ unit }}</p>
    <p class="mt-6 text-lg text-white/80">{{ detail }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  unitIcon: string;
  value: number;
  unit: string;
  detail: string;
}>();
</script>
