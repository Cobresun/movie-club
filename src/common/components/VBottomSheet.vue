<template>
  <!-- The overlay is a scroller: a screen-high gap, then a screen-high stage
       with the sheet at its foot. Scrolled to the sheet, it is open; scrolled
       back, the sheet sits below the screen. Swiping the sheet away is native
       scrolling, which the browser runs off the main thread at the display's
       refresh rate, with the platform's own momentum and snapping. -->
  <div
    ref="scrollerRef"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    class="sheet-scroller fixed inset-0 overscroll-contain scroll-smooth outline-hidden"
    :class="[
      contentZIndexClass,
      closing ? 'snap-none overflow-hidden' : 'snap-y snap-mandatory overflow-y-auto',
    ]"
    @click.stop=""
    @scroll.passive="onScroll"
  >
    <div class="h-full" @click.self="handleClose"></div>

    <div class="flex h-full flex-col justify-end" @click.self="handleClose">
      <!-- The closed snap point: the sheet's top edge at the foot of the screen.
           Releasing a swipe past halfway down the sheet settles here. -->
      <div class="snap-end"></div>

      <div
        ref="sheetRef"
        class="sheet bg-background duration-slow ease-emphasized relative flex min-h-0 w-full flex-col overflow-clip rounded-t-2xl transition-[min-height,max-height,bottom]"
        :style="keyboardStyle"
      >
        <!-- Inside the sheet, so its fade can follow the sheet's own view
             timeline; `fixed` still spans the screen. -->
        <div
          aria-hidden="true"
          class="sheet-backdrop pointer-events-none fixed inset-0 -z-10 bg-black/50"
        ></div>

        <!-- Outside the content's scroller, so swiping the grabber always moves
             the sheet, however far its content is scrolled. -->
        <div
          class="absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-center"
          :class="{ 'bg-background': !transparentHandle }"
        >
          <div class="h-1.5 w-12 rounded-full bg-gray-400"></div>
        </div>

        <!-- Default `overscroll-behavior`: a swipe down from the top of the
             content carries on into the overlay and pulls the sheet down. -->
        <div class="min-h-0 flex-1 overflow-y-auto pt-8">
          <div :class="contentClass">
            <!-- `closing` flips as soon as a dismissal the sheet animates
                 starts, so slot content can cancel deferred work instead of
                 janking the slide-out. -->
            <slot :closing="closing" />
          </div>
        </div>
      </div>

      <!-- The open snap point: the foot of the stage. On its own element
           rather than the sheet, so lifting the sheet over a keyboard doesn't
           move it and have the overlay scroll the sheet back down. -->
      <div class="snap-end"></div>
    </div>

    <!-- Sheet-coloured room below the sheet, so pulling it up stretches it
         rather than lifting it off the bottom of the screen. -->
    <div class="bg-background h-24"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";
import { useBackButtonClose } from "../composables/useBackButtonClose.js";
import { useBodyScrollLock } from "../composables/useBodyScrollLock.js";
import { useKeyboardInset } from "../composables/useKeyboardInset.js";
import { type ZIndex, zIndexClass } from "../zIndex.js";

const {
  contentClass = "px-4 pb-8",
  zIndex = "50",
  transparentHandle = false,
} = defineProps<{
  contentClass?: string;
  zIndex?: ZIndex;
  transparentHandle?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const contentZIndexClass = computed(() => zIndexClass(zIndex));

const scrollerRef = ref<HTMLElement>();
const sheetRef = ref<HTMLElement>();

// Set when the backdrop, the back button or the like dismisses the sheet. A
// swipe needs no such state: the user has already moved it off screen.
const closing = ref(false);
// Until the sheet first comes into view it is opening, not leaving.
let opened = false;
let closed = false;

useBodyScrollLock(computed(() => !closing.value));

const isOutOfView = (): boolean => {
  const scroller = scrollerRef.value;
  const sheet = sheetRef.value;
  if (!isDefined(scroller) || !isDefined(sheet)) return true;
  // A pixel of slack for scroll positions rounded to whole pixels.
  return scroller.scrollTop + scroller.clientHeight <= sheet.offsetTop + 1;
};

const finish = () => {
  if (closed) return;
  closed = true;
  emit("close");
};

const onScroll = () => {
  if (!isOutOfView()) {
    opened = true;
  } else if (opened || closing.value) {
    finish();
  }
};

const handleClose = () => {
  closing.value = true;
};

// Runs once `closing` has turned snapping off, so the scroll lands exactly
// where the sheet leaves the screen, even while a keyboard has lifted it above
// the closed snap point; and turned user scrolling off, so a touch can't stop
// the slide halfway.
watch(
  closing,
  () => {
    const scroller = scrollerRef.value;
    const sheet = sheetRef.value;
    if (isDefined(scroller) && isDefined(sheet)) {
      scroller.scrollTop = sheet.offsetTop - scroller.clientHeight;
    }
    // An instant scroll (reduced motion) has already arrived.
    if (isOutOfView()) finish();
  },
  { flush: "post" },
);

// Dismiss the sheet when the browser back button (or back gesture) is pressed.
useBackButtonClose(handleClose);

// Move focus into the dialog so keyboard and screen-reader users land in it,
// and hand it back to whatever opened it afterwards. `preventScroll` on both,
// or focusing would scroll the page behind the sheet. Captured during setup,
// before slot content mounts and possibly autofocuses a field of its own.
const returnFocusTo = document.activeElement;
onMounted(() => {
  const scroller = scrollerRef.value;
  if (!isDefined(scroller)) return;
  if (!scroller.contains(document.activeElement)) {
    scroller.focus({ preventScroll: true });
  }
  // `scroll-smooth` turns this into the opening slide; the open snap point
  // stops it with the sheet's foot on the foot of the screen.
  scroller.scrollTop = scroller.scrollHeight;
});
onUnmounted(() => {
  if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
    returnFocusTo.focus({ preventScroll: true });
  }
});

// A keyboard opening would otherwise shove the whole sheet upwards, leaving it
// floating mid-screen with a gap underneath. Instead the sheet grows into an
// expanded state: pinned to the top of the keyboard, filling everything above
// it, the way a native sheet does when you start typing in one.
const { keyboardInset, viewportHeight, viewportOffset } = useKeyboardInset();

// The expanded state is set through `min-height` and `max-height` rather than
// `height`: both have a length to ease from at rest, where `height: auto` has
// none and would snap while `bottom` eased, flinging the sheet's top off
// screen. The pan goes through `margin-bottom`, which isn't transitioned, so
// the sheet stays put on screen while iOS pans rather than easing after it. A
// `translate` would do the same but make the sheet the containing block of its
// `fixed` backdrop.
const keyboardStyle = computed(() => {
  if (keyboardInset.value <= 0) return {};
  const height = `${viewportHeight.value}px`;
  return {
    bottom: `${keyboardInset.value}px`,
    minHeight: height,
    maxHeight: height,
    marginBottom: `${-viewportOffset.value}px`,
  };
});
</script>

<style scoped>
.sheet-scroller {
  scrollbar-width: none;
}

.sheet-scroller::-webkit-scrollbar {
  display: none;
}

.sheet {
  /* Cap the sheet height so the grabber stays on screen. `dvh` tracks the
     *visible* viewport, which matters on mobile browsers (notably Chrome/Safari
     on iOS) where the address bar shrinks the visible area: plain `vh` resolves
     to the larger toolbar-hidden viewport, pushing the grabber off the top of
     the screen. `vh` is kept as a fallback for browsers without `dvh`. */
  max-height: 90vh;
  max-height: 90dvh;
  view-timeline: --sheet block;
}

/* The backdrop darkens as the sheet comes into view and lightens as it is
   swiped away, driven by the scroll itself rather than by script. Without
   scroll-driven animations it stays at full strength while the sheet is up.
   It rests at `opacity: 0` so the frame before the timeline attaches doesn't
   flash it at full strength. */
@supports (animation-timeline: view()) {
  .sheet-backdrop {
    opacity: 0;
    animation: sheet-backdrop linear both;
    animation-timeline: --sheet;
    animation-range: entry;
  }
}

@keyframes sheet-backdrop {
  to {
    opacity: 1;
  }
}
</style>
