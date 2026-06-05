<template>
  <Transition name="fade" appear>
    <div
      class="fixed inset-0 touch-none overscroll-none bg-black"
      :class="[zIndexClass, { 'bg-opacity-50': !isControlled }]"
      :style="controlledStyle"
      @click="handleClose"
      @touchmove.prevent
      @wheel.prevent
    ></div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    zIndex?: "40" | "50" | "60";
    /**
     * When provided (0–1), the scrim opacity is driven by the parent — used by
     * the bottom sheet to fade the backdrop continuously with the drag
     * position. When omitted, the default static 50% scrim is used.
     */
    opacity?: number;
  }>(),
  {
    zIndex: "50",
    opacity: undefined,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const zIndexClass =
  props.zIndex === "40" ? "z-40" : props.zIndex === "60" ? "z-[60]" : "z-50";

const isControlled = computed(() => props.opacity !== undefined);

const controlledStyle = computed(() =>
  props.opacity !== undefined
    ? { backgroundColor: `rgba(0, 0, 0, ${props.opacity})` }
    : undefined,
);

const handleClose = () => {
  emit("close");
};
</script>

<style scoped>
/* Fade transition for backdrop */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
