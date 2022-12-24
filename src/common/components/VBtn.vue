<template>
  <button 
    class="font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105" 
    @click="emit('click')"
  >
    <div class="flex my-1 mx-2">
      <slot />
    </div>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'click'): void
}>();
</script>