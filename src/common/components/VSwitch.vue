<template>
  <div
    class="inline-block cursor-pointer"
    :class="{ 'opacity-50': disabled }"
    @click="!disabled && emit('update:model-value', !modelValue)"
  >
    <div
      class="relative h-[22px] w-11 rounded-full py-0.5 pl-1 transition-colors duration-200"
      :class="{
        'bg-gray-600': !modelValue,
        'bg-primary': modelValue && color === 'primary',
        'bg-gray-400': modelValue && color !== 'primary',
      }"
    >
      <div
        class="h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200"
        :class="{ 'translate-x-full': modelValue }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { modelValue, color, disabled } = defineProps<{
  modelValue: boolean;
  color?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:model-value", value: boolean): void;
}>();
</script>
