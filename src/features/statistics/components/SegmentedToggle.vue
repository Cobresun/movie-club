<template>
  <div
    role="tablist"
    class="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-background/60 p-1"
  >
    <button
      v-for="option in options"
      :key="option.value"
      role="tab"
      :aria-selected="option.value === modelValue"
      class="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all"
      :class="
        option.value === modelValue
          ? 'bg-primary text-white shadow-md shadow-primary/25'
          : 'text-gray-400 hover:bg-gray-600/40 hover:text-white'
      "
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  options: readonly { value: T; label: string }[];
  modelValue: T;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
}>();
</script>
