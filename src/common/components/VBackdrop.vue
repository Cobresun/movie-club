<template>
  <Transition name="fade" appear>
    <div
      v-if="visible"
      class="backdrop fixed inset-0 touch-none overscroll-none bg-black bg-opacity-50"
      :class="zIndexClass"
      :style="{ opacity, transition: tracking ? 'none' : undefined }"
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
    // Owners flip this when their dismissal starts, so the backdrop fades out
    // alongside the panel instead of vanishing when the owner unmounts.
    visible?: boolean;
    // Dims the backdrop along with a dragged panel; unset leaves it fully on.
    opacity?: number;
    // True while a finger drives `opacity`, so it follows without easing.
    tracking?: boolean;
  }>(),
  {
    zIndex: "50",
    visible: true,
    opacity: undefined,
    tracking: false,
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
/* Also eases `opacity` changes outside enter/leave, e.g. settling back after a
   drag. */
.backdrop {
  transition: opacity var(--motion-base) var(--ease-standard);
}

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
