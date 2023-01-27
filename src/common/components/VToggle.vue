<template>
  <div class="relative inline-block">
    <input
      type="checkbox"
      class="hidden"
      :checked="modelValue"
      @change="
        emit('update:modelValue', ($event.target as HTMLInputElement).checked)
      "
    />
    <div
      class="relative w-12 h-6 bg-primary rounded-full shadow-inner cursor-pointer"
      @click="emit('update:modelValue', !modelValue)"
    >
      <div
        class="absolute mt-1 ml-1 w-4 h-4 rounded-full bg-white transition-all"
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
