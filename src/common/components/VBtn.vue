<template>
  <button
    class="text-text duration-fast ease-standard rounded-md text-center text-base font-bold tracking-wide transition"
    :class="{
      'bg-gray-600': disabled,
      'bg-primary cursor-pointer hover:brightness-110 active:scale-[0.97] active:brightness-105':
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
