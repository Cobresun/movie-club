<template>
  <div>
    <v-backdrop
      ref="backdropRef"
      :z-index="backdropZIndex"
      :visible="isVisible"
      @close="handleClose"
    />

    <Transition name="slide-up" appear @after-leave="onTransitionEnd">
      <!-- Touch listeners sit on the whole sheet so pulling down from the top
           of the content drags it, not just the grabber. `touchmove` stays
           non-passive: it has to cancel the scroll once a drag is claimed. -->
      <div
        v-if="isVisible"
        ref="sheetRef"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="sheet fixed inset-x-0 bottom-0 w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-background outline-none transition-[transform,height,bottom] duration-slow ease-emphasized"
        :class="contentZIndexClass"
        :style="sheetStyle"
        @click.stop=""
        @touchstart.passive="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend.passive="handleTouchEnd"
        @touchcancel.passive="handleTouchEnd"
      >
        <div
          ref="handleRef"
          class="sticky top-0 z-10 flex h-8 w-full touch-none items-center justify-center"
          :class="{ 'bg-background': !transparentHandle }"
        >
          <div class="h-1.5 w-12 rounded-full bg-gray-400"></div>
        </div>

        <div :class="contentClass">
          <!-- `closing` flips as soon as dismissal starts (the sheet stays
               mounted while the leave transition plays), so slot content can
               cancel deferred work instead of janking the slide-out. -->
          <slot :closing="!isVisible" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import { useBackButtonClose } from "../composables/useBackButtonClose.js";
import { useBodyScrollLock } from "../composables/useBodyScrollLock.js";
import { useKeyboardInset } from "../composables/useKeyboardInset.js";
import { type ZIndex, lowerZIndex, zIndexClass } from "../zIndex.js";
import VBackdrop from "./VBackdrop.vue";

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

const backdropZIndex = computed(() => lowerZIndex(props.zIndex));

const contentZIndexClass = computed(() => zIndexClass(props.zIndex));

const sheetRef = ref<HTMLElement>();
const handleRef = ref<HTMLElement>();
const backdropRef = ref<InstanceType<typeof VBackdrop>>();

const isVisible = ref(true);
const onTransitionEnd = () => {
  emit("close");
};

useBodyScrollLock(isVisible);

// Every dismissal goes through the leave transition, so the sheet always
// slides out rather than vanishing.
const handleClose = () => {
  isVisible.value = false;
};

// Dismiss the sheet when the browser back button (or back gesture) is pressed.
useBackButtonClose(handleClose);

// Move focus into the dialog so keyboard and screen-reader users land in it,
// and hand it back to whatever opened it afterwards. `preventScroll` on both,
// or focusing would scroll the page behind the sheet. Captured during setup,
// before slot content mounts and possibly autofocuses a field of its own.
const returnFocusTo = document.activeElement;
onMounted(() => {
  if (!sheetRef.value?.contains(document.activeElement)) {
    sheetRef.value?.focus({ preventScroll: true });
  }
});
onUnmounted(() => {
  if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
    returnFocusTo.focus({ preventScroll: true });
  }
});

// Drag to dismiss. The drag writes `transform` straight onto the element
// rather than through reactive state: touchmove fires every frame, and a
// re-render of the sheet and its slot per event drops frames. Transitions are
// off while the finger is down so the sheet tracks it 1:1, and back on at
// release so it settles back or slides the rest of the way out from exactly
// where it was let go.

// Released past this fraction of the sheet's height, the sheet dismisses.
const DISMISS_FRACTION = 0.25;
// A downward flick faster than this (px/ms) dismisses regardless of distance…
const FLING_VELOCITY = 0.5;
// …as long as it travelled far enough not to be a sloppy tap.
const FLING_MIN_DISTANCE = 16;
// Release velocity is measured over the tail of the gesture, not the whole of
// it, so a slow drag ending in a flick reads as a flick.
const VELOCITY_WINDOW_MS = 100;

const BACKDROP_SETTLE = "opacity var(--motion-base) var(--ease-standard)";

interface Gesture {
  startX: number;
  startY: number;
  // `pending` until the first move decides between dragging the sheet and
  // letting the content scroll; a gesture never switches after that.
  mode: "pending" | "drag" | "scroll";
  offset: number;
  height: number;
  samples: { y: number; t: number }[];
}

let gesture: Gesture | undefined;

// The backdrop's root is its fade `<Transition>`, so `$el` is the backdrop
// element while shown and a placeholder comment once it has left.
const backdropEl = (): HTMLElement | undefined => {
  const el: unknown = backdropRef.value?.$el;
  return el instanceof HTMLElement ? el : undefined;
};

const applyOffset = (offset: number, settle: boolean) => {
  const sheet = sheetRef.value;
  if (!sheet) return;
  sheet.style.transition = settle ? "" : "none";
  sheet.style.transform = offset > 0 ? `translateY(${offset}px)` : "";

  const backdrop = backdropEl();
  if (backdrop) {
    backdrop.style.transition = settle ? BACKDROP_SETTLE : "none";
    backdrop.style.opacity = offset > 0 ? String(Math.max(0, 1 - offset / sheet.offsetHeight)) : "";
  }
};

// Whether a touch landing on `target` may pull the sheet down. Not when it
// lands on a field or on a control handling its own touches (`touch-action:
// none`, e.g. the score dial), and not while anything between it and the
// sheet is scrolled — then pulling down scrolls back up first, as natively.
const contentCanDrag = (target: EventTarget | null): boolean => {
  const sheet = sheetRef.value;
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.matches("input, textarea, select, [contenteditable]")) return false;
    if (getComputedStyle(el).touchAction === "none") return false;
    if (el.scrollTop > 0) return false;
    if (el === sheet) return true;
  }
  return false;
};

const handleTouchStart = (event: TouchEvent) => {
  gesture = undefined;
  const sheet = sheetRef.value;
  if (!isVisible.value || !sheet || event.touches.length !== 1) return;

  const touch = event.touches[0];
  const fromHandle = handleRef.value?.contains(event.target as Node) ?? false;
  gesture = {
    startX: touch.clientX,
    startY: touch.clientY,
    mode: fromHandle ? "drag" : contentCanDrag(event.target) ? "pending" : "scroll",
    offset: 0,
    height: sheet.offsetHeight,
    samples: [{ y: touch.clientY, t: event.timeStamp }],
  };
};

const handleTouchMove = (event: TouchEvent) => {
  if (!gesture || gesture.mode === "scroll" || event.touches.length !== 1) return;

  const touch = event.touches[0];
  const dx = touch.clientX - gesture.startX;
  const dy = touch.clientY - gesture.startY;

  if (gesture.mode === "pending") {
    if (dx === 0 && dy === 0) return;
    // Mostly-downward from the top of the content drags the sheet; anything
    // else (scrolling up, a sideways swipe) is left to the browser.
    gesture.mode = dy > 0 && dy >= Math.abs(dx) ? "drag" : "scroll";
    if (gesture.mode === "scroll") return;
  }

  if (event.cancelable) event.preventDefault();

  gesture.offset = Math.max(0, dy);
  const samples = gesture.samples;
  samples.push({ y: touch.clientY, t: event.timeStamp });
  while (samples.length > 2 && event.timeStamp - samples[0].t > VELOCITY_WINDOW_MS) {
    samples.shift();
  }

  applyOffset(gesture.offset, false);
};

const releaseVelocity = (samples: Gesture["samples"]): number => {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsed = last.t - first.t;
  return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
};

const handleTouchEnd = (event: TouchEvent) => {
  const ended = gesture;
  gesture = undefined;
  if (!ended || ended.mode !== "drag") return;

  const velocity = releaseVelocity(ended.samples);
  const flungDown = velocity > FLING_VELOCITY && ended.offset > FLING_MIN_DISTANCE;
  const flungUp = velocity < -FLING_VELOCITY;
  const shouldClose =
    event.type === "touchend" &&
    (flungDown || (!flungUp && ended.offset > ended.height * DISMISS_FRACTION));

  if (!shouldClose) {
    applyOffset(0, true);
    return;
  }

  // Continue from where the finger let go: restore the transition and aim
  // both layers at their closed state in the same frame the leave starts.
  const sheet = sheetRef.value;
  if (sheet) {
    sheet.style.transition = "";
    sheet.style.transform = "translateY(100%)";
  }
  const backdrop = backdropEl();
  if (backdrop) {
    backdrop.style.transition = BACKDROP_SETTLE;
    backdrop.style.opacity = "0";
  }
  handleClose();
};

// A keyboard opening would otherwise shove the whole sheet upwards, leaving it
// floating mid-screen with a gap underneath. Instead the sheet grows into an
// expanded state: pinned to the top of the keyboard, filling everything above
// it, the way a native sheet does when you start typing in one.
const { keyboardInset, viewportHeight } = useKeyboardInset();

const sheetStyle = computed(() => {
  if (keyboardInset.value <= 0) return {};
  return {
    bottom: `${keyboardInset.value}px`,
    height: `${viewportHeight.value}px`,
    maxHeight: `${viewportHeight.value}px`,
  };
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
  transition: transform var(--motion-slow) var(--ease-emphasized);
}

/* No `leave-from` state: the leave starts from wherever the sheet is, which
   after a drag is partway down, not fully open. */
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
