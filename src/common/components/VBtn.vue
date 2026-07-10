<template>
  <button
    class="rounded-md text-center text-base font-bold tracking-wide text-text transition duration-fast ease-standard"
    :class="{
      'bg-gray-600': disabled,
      'cursor-pointer bg-primary hover:brightness-110 active:scale-[0.97] active:brightness-105':
        !disabled,
    }"
    :disabled="disabled"
    @click="emit('click')"
  >
    <div class="mx-2 my-1 flex items-center justify-center">
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
