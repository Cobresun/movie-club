<template>
  <div
    class="fixed z-50 top-0 left-0 w-full h-full bg-opacity-50 bg-black flex justify-center items-center"
    @click="emit('close')"
  >
    <div class="rounded-lg bg-background p-8 h-2/3 w-1/2" @click.stop="">
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
