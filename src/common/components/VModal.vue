<template>
  <div
    class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
    @click="emit('close')"
  >
    <div
      class="h-5/6 w-5/6 rounded-lg bg-background p-8 md:h-2/3 md:w-1/2"
      @click.stop=""
    >
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
