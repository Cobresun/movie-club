<template>
  <div class="relative w-full max-w-[240px] select-none">
    <svg
      ref="dialSvg"
      class="block w-full cursor-pointer touch-none text-lowBackground"
      :viewBox="`0 0 ${DIAL_VIEWBOX_WIDTH} ${DIAL_VIEWBOX_HEIGHT}`"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <path
        :d="DIAL_TRACK_PATH"
        fill="none"
        stroke="currentColor"
        stroke-width="12"
        stroke-linecap="round"
      />
      <path
        v-if="fraction > 0"
        :d="DIAL_TRACK_PATH"
        fill="none"
        :stroke="band.color"
        stroke-width="12"
        stroke-linecap="round"
        pathLength="1"
        :stroke-dasharray="`${fraction} 1`"
        :class="isDragging ? undefined : arcTransition"
      />
      <circle
        :cx="handle.x"
        :cy="handle.y"
        r="11"
        fill="#fff"
        class="cursor-grab drop-shadow"
        :class="isDragging ? undefined : arcTransition"
      />
    </svg>

    <div
      class="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center gap-1"
    >
      <input
        ref="scoreInput"
        v-model="model"
        type="number"
        inputmode="decimal"
        :min="SCORE_MIN"
        :max="SCORE_MAX"
        :step="SCORE_STEP"
        placeholder="8.5"
        aria-label="Score"
        class="pointer-events-auto w-24 border-b-2 border-dotted border-gray-500 bg-transparent text-center text-4xl font-bold tabular-nums text-gray-500 outline-none transition-colors duration-fast ease-standard [appearance:textfield] placeholder:text-gray-600 focus:border-gray-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        :style="hasScore ? { color: band.color } : undefined"
        @input="onInput"
        @keydown.enter="emit('save')"
      />
      <div class="flex h-6 items-center">
        <span
          v-if="hasValue(clampNotice)"
          class="rounded-full px-3 py-0.5 text-xs font-semibold text-gray-950"
          :style="{ backgroundColor: band.color }"
        >
          {{ clampNotice }}
        </span>
        <span
          v-else-if="hasScore"
          class="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400"
        >
          {{ band.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { scoreBand } from "../scoreBands";
import {
  DIAL_TRACK_PATH,
  DIAL_VIEWBOX_HEIGHT,
  DIAL_VIEWBOX_WIDTH,
  handlePosition,
  scoreFromPoint,
  scoreToFraction,
} from "../scoreDialGeometry";
import {
  formatScore,
  isValidScore,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_STEP,
} from "../scoreScale";

import { hapticTick } from "@/common/haptics";

// The draft score stays a string so the input round-trips partial typing
// ("8.", "") and preserves the exact decimals the user entered; the arc only
// reacts once the string parses to a valid score.
const model = defineModel<string>({ required: true });

const emit = defineEmits<{
  (e: "save"): void;
}>();

const arcTransition = "transition-all duration-fast ease-standard";

const dialSvg = ref<SVGSVGElement | null>(null);
const scoreInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const parsedScore = computed(() => Number.parseFloat(model.value));
const hasScore = computed(() => isValidScore(parsedScore.value));
const fraction = computed(() =>
  hasScore.value ? scoreToFraction(parsedScore.value) : 0,
);
const band = computed(() => scoreBand(hasScore.value ? parsedScore.value : 0));
const handle = computed(() => handlePosition(fraction.value));

const clampNotice = ref("");
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const showClampNotice = (message: string) => {
  clampNotice.value = message;
  if (isDefined(noticeTimer)) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    clampNotice.value = "";
  }, 2500);
};

onBeforeUnmount(() => {
  if (isDefined(noticeTimer)) clearTimeout(noticeTimer);
});

// v-model owns echoing typed text back to the DOM (its directive skips the
// write while the input is focused, which keeps partial states like "8."
// alive — a number input's value setter would sanitize them to ""). This
// handler only intervenes when the typed value leaves the scale: it clamps
// both the model and the DOM directly, since Vue won't re-patch when two
// inputs in a row clamp to the same model value (e.g. "12" then "120").
const onInput = (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const typed = Number.parseFloat(target.value);
  if (Number.isNaN(typed)) return;
  if (typed > SCORE_MAX) {
    model.value = String(SCORE_MAX);
    target.value = String(SCORE_MAX);
    showClampNotice(`Max is ${SCORE_MAX} — set to ${SCORE_MAX.toFixed(1)}`);
  } else if (typed < SCORE_MIN) {
    model.value = String(SCORE_MIN);
    target.value = String(SCORE_MIN);
    showClampNotice(`Min is ${SCORE_MIN} — set to ${SCORE_MIN.toFixed(1)}`);
  }
};

const scoreAtPointer = (event: PointerEvent): number | undefined => {
  const svg = dialSvg.value;
  if (!isDefined(svg)) return undefined;
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0) return undefined;
  const scale = DIAL_VIEWBOX_WIDTH / rect.width;
  return scoreFromPoint(
    (event.clientX - rect.left) * scale,
    (event.clientY - rect.top) * scale,
  );
};

// Last detent the drag ticked at, so crossing each SCORE_STEP buzzes once
// like a physical dial. Seeded from the current score on pointerdown so
// grabbing the handle where it already sits stays silent.
let lastDetent: number | undefined;

const applyPointer = (event: PointerEvent) => {
  const score = scoreAtPointer(event);
  if (!isDefined(score)) return;
  if (score !== lastDetent) {
    lastDetent = score;
    hapticTick();
  }
  // formatScore keeps quarter steps exact ("8.25") where toFixed(1) would
  // round them to a value off the snap grid.
  model.value = formatScore(score);
};

const onPointerDown = (event: PointerEvent) => {
  event.preventDefault();
  isDragging.value = true;
  lastDetent = hasScore.value ? parsedScore.value : undefined;
  dialSvg.value?.setPointerCapture(event.pointerId);
  applyPointer(event);
};

const onPointerMove = (event: PointerEvent) => {
  if (!isDragging.value) return;
  applyPointer(event);
};

const endDrag = () => {
  isDragging.value = false;
};

defineExpose({
  focusInput: () => {
    scoreInput.value?.focus();
    scoreInput.value?.select();
  },
});
</script>
