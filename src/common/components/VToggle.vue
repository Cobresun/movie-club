<template>
  <div class="relative inline-block">
    <div
      role="switch"
      :aria-checked="modelValue"
      class="relative h-6 w-12 cursor-pointer rounded-full bg-primary shadow-inner"
      @click="emit('update:modelValue', !modelValue)"
    >
      <div
        class="absolute ml-1 mt-1 h-4 w-4 rounded-full bg-white transition-all"
        :class="{ 'translate-x-6': modelValue }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { modelValue } = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: "update:modelValue", checked: boolean): void;
}>();
</script>
