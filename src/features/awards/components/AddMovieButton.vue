<template>
  <button class="mb-4 min-h-[286px] w-40 rounded border-2 border-gray-200" :aria-label="label">
    <div class="flex h-full items-center justify-center">
      <mdicon name="plus" />
    </div>
  </button>
</template>
<script setup lang="ts">
defineProps<{ label: string }>();
</script>
