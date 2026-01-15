<template>
  <div>
    <v-bottom-sheet
      v-if="!isDesktop"
      content-class="p-8"
      :z-index="zIndex"
      @close="emit('close')"
    >
      <slot />
    </v-bottom-sheet>

    <template v-if="isDesktop">
      <v-backdrop :z-index="zIndex" @close="handleClose" />

      <Transition name="fade" appear @after-leave="onTransitionEnd">
        <div
          v-if="isVisible"
          class="fixed bg-background p-8"
          :class="[desktopClasses, zIndexClass]"
          @click.stop=""
        >
          <slot />
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import VBackdrop from "./VBackdrop.vue";
import VBottomSheet from "./VBottomSheet.vue";
import { useBodyScrollLock } from "../composables/useBodyScrollLock";
import { useIsDesktop } from "../composables/useIsDesktop.js";

type ModalSize = "default" | "sm" | "lg" | "full";
type ZIndex = "40" | "50" | "60";

const props = withDefaults(
  defineProps<{
    size?: ModalSize;
    zIndex?: ZIndex;
  }>(),
  {
    zIndex: "50",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const isDesktop = useIsDesktop();

const isVisible = ref(true);

const handleClose = () => {
  isVisible.value = false;
};

const onTransitionEnd = () => {
  emit("close");
};

useBodyScrollLock(isVisible, isDesktop);

const desktopSizeMap: Record<ModalSize, string> = {
  sm: "w-full max-w-md",
  default: "h-2/3 w-1/2",
  lg: "h-3/4 w-2/3",
  full: "h-full w-full",
};

const desktopClasses = computed(() => {
  const sizeClass = desktopSizeMap[props.size ?? "default"];
  return `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg ${sizeClass}`;
});

const zIndexClass = computed(() =>
  props.zIndex === "40" ? "z-40" :
  props.zIndex === "60" ? "z-[60]" :
  "z-50"
);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
