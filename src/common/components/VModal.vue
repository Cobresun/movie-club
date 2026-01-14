<template>
  <div>
    <v-bottom-sheet
      v-if="!isDesktop"
      content-class="p-8"
      @close="emit('close')"
    >
      <slot />
    </v-bottom-sheet>

    <template v-if="isDesktop">
      <v-backdrop @close="handleClose" />

      <Transition name="fade" appear @after-leave="onTransitionEnd">
        <div
          v-if="isVisible"
          class="fixed z-50 bg-background p-8"
          :class="desktopClasses"
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

const props = defineProps<{
  size?: ModalSize;
}>();

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
