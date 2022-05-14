<template>
  <button 
    @click="emit('click')" 
    class="font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105"
  >
    <div class="flex my-1 mx-2">
      <slot></slot>
    </div>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'click'): void
}>();
</script>