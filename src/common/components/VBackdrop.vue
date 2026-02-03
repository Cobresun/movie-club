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
const props = withDefaults(
  defineProps<{
    zIndex?: "40" | "50" | "60";
  }>(),
  {
    zIndex: "50",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const zIndexClass =
  props.zIndex === "40" ? "z-40" :
  props.zIndex === "60" ? "z-[60]" :
  "z-50";

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
