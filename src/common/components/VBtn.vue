<template>
  <button
    class="font-bold text-base text-text tracking-wide text-center rounded-md duration-150 filter"
    :class="{
      'bg-gray-600': disabled,
      'bg-primary cursor-pointer hover:brightness-110 active:brightness-105':
        !disabled,
    }"
    :disabled="disabled"
    @click="emit('click')"
  >
    <div class="flex my-1 mx-2">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
const { disabled = false } = defineProps<{ disabled?: boolean }>();

const emit = defineEmits<{
  (e: "click"): void;
}>();
</script>
