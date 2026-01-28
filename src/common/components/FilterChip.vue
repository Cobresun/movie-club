<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm text-text"
  >
    <span v-if="label" class="font-medium">{{ label }}:</span>
    <span>{{ value }}</span>
    <button
      type="button"
      class="ml-1 rounded-full p-0.5 hover:bg-primary/30"
      @click="emit('remove')"
    >
      <mdicon name="close" size="14" />
    </button>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  label?: string;
  value: string;
}>();

const emit = defineEmits<{
  (e: "remove"): void;
}>();
</script>
