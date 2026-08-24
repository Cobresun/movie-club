<template>
  <Transition name="fade" appear>
    <div
      class="fixed inset-0 touch-none overscroll-none bg-black bg-opacity-50"
      :class="zIndexClass"
      @click="handleClose"
      @touchmove.prevent
      @wheel.prevent
    ></div>
  </Transition>
</template>

<script setup lang="ts">
import { type ZIndex, zIndexClass as zIndexClassOf } from "../zIndex.js";

const props = withDefaults(
  defineProps<{
    zIndex?: ZIndex;
  }>(),
  {
    zIndex: "50",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const zIndexClass = zIndexClassOf(props.zIndex);

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
/* Fade transition for backdrop */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--ease-standard);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
