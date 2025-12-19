<template>
  <div
    class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
    @click="emit('close')"
  >
    <div
      class="rounded-lg bg-background p-8"
      :class="sizeClasses"
      @click.stop=""
    >
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";

type ModalSize = "default" | "sm" | "lg" | "full";

const { size = "default" } = defineProps<{
  size?: ModalSize;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const sizeMap: Record<ModalSize, string> = {
  sm: "w-full max-w-md",
  default: "h-5/6 w-5/6 md:h-2/3 md:w-1/2",
  lg: "h-5/6 w-11/12 md:h-3/4 md:w-2/3",
  full: "h-full w-full",
};

const sizeClasses = computed(() => sizeMap[size]);
</script>
