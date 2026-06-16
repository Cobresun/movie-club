<template>
  <div>
    <v-backdrop :z-index="backdropZIndex" @close="handleClose" />

    <Transition name="slide-up" appear @after-leave="onTransitionEnd">
      <div
        v-if="isVisible"
        ref="sheetRef"
        class="sheet fixed inset-x-0 bottom-0 w-full overflow-y-auto rounded-t-2xl bg-background"
        :class="[
          contentZIndexClass,
          {
            'transition-transform duration-200 ease-in-out': !isDragging,
          },
        ]"
        :style="sheetStyle"
        @click.stop=""
      >
        <div
          class="sticky top-0 z-10 flex h-8 w-full cursor-pointer items-center justify-center"
          :class="{ 'bg-background': !transparentHandle }"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <div class="h-1.5 w-12 rounded-full bg-gray-400"></div>
        </div>

        <div :class="contentClass">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import VBackdrop from "./VBackdrop.vue";
import { useBackButtonClose } from "../composables/useBackButtonClose.js";
import { useBodyScrollLock } from "../composables/useBodyScrollLock.js";

type ZIndex = "40" | "50" | "60";

const props = withDefaults(
  defineProps<{
    contentClass?: string;
    zIndex?: ZIndex;
    transparentHandle?: boolean;
  }>(),
  {
    contentClass: "px-4 pb-8",
    zIndex: "50",
    transparentHandle: false,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

const backdropZIndex = computed(() => {
  // Backdrop should be one level lower than content
  return props.zIndex === "60" ? "50" : props.zIndex === "50" ? "40" : "40";
});

const contentZIndexClass = computed(() =>
  props.zIndex === "40" ? "z-40" : props.zIndex === "60" ? "z-[60]" : "z-50",
);

const isVisible = ref(true);
const onTransitionEnd = () => {
  emit("close");
};

useBodyScrollLock(isVisible);

const handleClose = (immediate = false) => {
  if (immediate) {
    emit("close");
  } else {
    isVisible.value = false;
  }
};

// Dismiss the sheet when the browser back button (or back gesture) is pressed.
useBackButtonClose(() => handleClose());

const touchStartY = ref<number | null>(null);
const touchStartTime = ref<number | null>(null);
const dragOffset = ref(0);
const isDragging = ref(false);

const handleTouchStart = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.touches.length === 1) {
    touchStartY.value = event.touches[0].clientY;
    touchStartTime.value = Date.now();
    isDragging.value = true;
    dragOffset.value = 0;
  }
};

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (touchStartY.value !== null && event.touches.length === 1) {
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - touchStartY.value;
    if (deltaY > 0) {
      dragOffset.value = deltaY * 0.8;
    } else {
      dragOffset.value = 0;
    }
  }
};

const handleTouchEnd = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (
    touchStartY.value !== null &&
    touchStartTime.value !== null &&
    event.changedTouches.length === 1
  ) {
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchEndY - touchStartY.value;
    const deltaTime = touchEndTime - touchStartTime.value;
    const velocity = deltaY / deltaTime;

    const shouldClose = deltaY > 100 || (deltaY > 50 && velocity > 0.3);

    if (shouldClose) {
      handleClose(true);
    } else {
      dragOffset.value = 0;
    }
  }

  isDragging.value = false;
  touchStartY.value = null;
  touchStartTime.value = null;
};

const sheetStyle = computed(() => {
  if (isDragging.value || dragOffset.value > 0) {
    return {
      transform: `translateY(${Math.max(0, dragOffset.value)}px)`,
    };
  }
  return {};
});
</script>

<style scoped>
.sheet {
  /* Cap the sheet height so the grabber stays on screen. `dvh` tracks the
     *visible* viewport, which matters on mobile browsers (notably Chrome/Safari
     on iOS) where the address bar shrinks the visible area: plain `vh` resolves
     to the larger toolbar-hidden viewport, pushing the grabber off the top of
     the screen. `vh` is kept as a fallback for browsers without `dvh`. */
  max-height: 90vh;
  max-height: 90dvh;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 200ms ease-in-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
}
</style>
