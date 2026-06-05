<template>
  <Teleport to="body">
    <v-backdrop
      :z-index="backdropZIndex"
      :opacity="backdropOpacity"
      @close="requestClose"
    />

    <div
      ref="hostRef"
      class="sheet-host fixed inset-0 overflow-y-scroll overscroll-contain"
      :class="[
        contentZIndexClass,
        snapEnabled ? 'snap-y snap-mandatory' : 'snap-none',
      ]"
      role="dialog"
      aria-modal="true"
      :aria-label="ariaLabel"
      tabindex="-1"
    >
      <!--
        Transparent runway above the panel. It is the scrim region (the backdrop
        shows through it), it dismisses on tap, and it hosts the zero-height snap
        markers whose offsets define the rest positions:
          top: 0        -> dismissed (panel below the fold)
          top: halfTop  -> half revealed
          top: fullTop  -> fully revealed
      -->
      <div class="relative h-full w-full" @click="requestClose">
        <div class="absolute inset-x-0 top-0 h-0 snap-start"></div>
        <div
          v-if="hasHalfDetent"
          class="absolute inset-x-0 h-0 snap-start"
          :style="{ top: `${halfTop}px` }"
        ></div>
        <div
          class="absolute inset-x-0 h-0 snap-start"
          :style="{ top: `${fullTop}px` }"
        ></div>
      </div>

      <!-- The visible sheet panel. -->
      <div
        class="relative flex max-h-[90%] w-full flex-col rounded-t-2xl bg-background"
      >
        <div
          class="flex h-8 w-full shrink-0 cursor-grab items-center justify-center"
          :class="{ 'bg-background': !transparentHandle }"
        >
          <div class="h-1.5 w-12 rounded-full bg-gray-400"></div>
        </div>

        <!--
          expand-to-scroll: content only scrolls at the full detent, so a
          swipe-up at the half detent unambiguously expands the sheet rather than
          scrolling content (and mandatory snap never fights a mid-content rest).
        -->
        <div
          class="min-h-0 flex-1"
          :class="[
            contentClass,
            atFull ? 'overflow-y-auto' : 'overflow-hidden',
          ]"
        >
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import VBackdrop from "./VBackdrop.vue";
import { useBodyScrollLock } from "../composables/useBodyScrollLock.js";
import {
  useBottomSheetSnap,
  type Detent,
  type SnapState,
} from "../composables/useBottomSheetSnap.js";
import { useFocusTrap } from "../composables/useFocusTrap.js";

type ZIndex = "40" | "50" | "60";

const props = withDefaults(
  defineProps<{
    contentClass?: string;
    zIndex?: ZIndex;
    transparentHandle?: boolean;
    /** Enabled rest positions. Defaults to a single open ("full") state. */
    detents?: Detent[];
    /** Which detent to open at. */
    initialDetent?: Detent;
    /** Accessible name for the dialog. */
    ariaLabel?: string;
  }>(),
  {
    contentClass: "px-4 pb-8",
    zIndex: "50",
    transparentHandle: false,
    detents: () => ["full"],
    initialDetent: "full",
    ariaLabel: undefined,
  },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "snap-change", state: SnapState): void;
}>();

const backdropZIndex = computed<ZIndex>(() =>
  props.zIndex === "60" ? "50" : "40",
);

const contentZIndexClass = computed(() =>
  props.zIndex === "40" ? "z-40" : props.zIndex === "60" ? "z-[60]" : "z-50",
);

const hasHalfDetent = computed(() => props.detents.includes("half"));

const hostRef = ref<HTMLElement | null>(null);

// Stays true for the component's lifetime; the parent's v-if mounts/unmounts us,
// so locking on mount and releasing on unmount is exactly the desired behavior.
const isActive = ref(true);
useBodyScrollLock(isActive);
useFocusTrap(hostRef, isActive);

const {
  snapEnabled,
  backdropOpacity,
  atFull,
  halfTop,
  fullTop,
  open,
  requestClose,
} = useBottomSheetSnap({
  host: hostRef,
  detents: () => props.detents,
  initialDetent: () => props.initialDetent,
  onClose: () => emit("close"),
  onSnapChange: (state) => emit("snap-change", state),
});

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") requestClose();
};

onMounted(() => {
  open();
  document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
/* Hide the host's scrollbar — the scroll position is an interaction mechanism,
   not something the user should see a track for. */
.sheet-host {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sheet-host::-webkit-scrollbar {
  display: none;
}
</style>
