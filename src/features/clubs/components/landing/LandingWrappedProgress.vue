<template>
  <div class="flex gap-1" aria-hidden="true">
    <span
      v-for="index in 4"
      :key="index"
      class="h-0.5 grow rounded-full"
      :class="index <= seen ? 'bg-white' : 'bg-white/35'"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ seen: number }>();
</script>
