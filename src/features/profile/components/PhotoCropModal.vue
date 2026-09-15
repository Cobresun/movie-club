<template>
  <v-modal size="sm" @close="emit('cancel')">
    <div class="flex flex-col gap-5">
      <h2 class="text-center text-xl font-bold">Crop photo</h2>

      <div
        class="relative mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-lg bg-black"
      >
        <canvas
          ref="preview"
          class="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          role="img"
          aria-label="Crop preview"
          :aria-describedby="hintId"
          tabindex="0"
          :width="PREVIEW_RESOLUTION"
          :height="PREVIEW_RESOLUTION"
          @pointerdown="startDrag"
          @pointermove="drag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @wheel.prevent="zoomByWheel"
          @keydown="panByKey"
        />
        <!-- Dims the corners the round avatar will cut off. -->
        <div
          class="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ring-2 ring-white/70"
        />
      </div>

      <p :id="hintId" class="-mt-2 text-center text-xs text-white/50">
        Drag, or use the arrow keys, to reposition
      </p>

      <label class="flex items-center gap-3">
        <span class="text-sm text-white/60">Zoom</span>
        <input
          v-model.number="zoom"
          type="range"
          class="flex-1 accent-primary"
          :min="MIN_ZOOM"
          :max="MAX_ZOOM"
          step="0.01"
        />
      </label>

      <div class="flex gap-3">
        <v-btn class="min-h-[44px] flex-1 bg-gray-600 hover:bg-gray-700" @click="emit('cancel')">
          Cancel
        </v-btn>
        <v-btn class="min-h-[44px] flex-1" :disabled="isSaving" @click="save">Save photo</v-btn>
      </div>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watchEffect } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import { drawCrop, exportCrop } from "../avatarImage";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centeredCrop,
  clampCrop,
  cropRect,
  panCrop,
  type CropState,
} from "../cropGeometry";

const PREVIEW_RESOLUTION = 640;
const KEY_PAN_STEP = 12;

const props = defineProps<{ image: ImageBitmap }>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "save", photo: Blob): void;
}>();

const toast = useToast();
const hintId = useId();
const preview = useTemplateRef<HTMLCanvasElement>("preview");

const crop = ref<CropState>(centeredCrop(props.image));

const zoom = computed({
  get: () => crop.value.zoom,
  set: (value: number) => {
    crop.value = clampCrop(props.image, { ...crop.value, zoom: value });
  },
});

watchEffect(
  () => {
    if (!isDefined(preview.value)) return;
    drawCrop(preview.value, props.image, cropRect(props.image, crop.value));
  },
  { flush: "post" },
);

const pan = (dx: number, dy: number) => {
  const previewSize = preview.value?.clientWidth ?? 0;
  if (previewSize === 0) return;
  crop.value = panCrop(props.image, crop.value, dx, dy, previewSize);
};

// One pointer pans; a second one turns the gesture into a pinch zoom.
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart: { distance: number; zoom: number } | undefined;

const pinchDistance = () => {
  const [first, second] = [...pointers.values()];
  if (!isDefined(first) || !isDefined(second)) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
};

const startDrag = (event: PointerEvent) => {
  preview.value?.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  pinchStart =
    pointers.size === 2 ? { distance: pinchDistance(), zoom: crop.value.zoom } : undefined;
};

const drag = (event: PointerEvent) => {
  const previous = pointers.get(event.pointerId);
  if (!isDefined(previous)) return;

  const current = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, current);

  if (isDefined(pinchStart)) {
    if (pinchStart.distance > 0) {
      zoom.value = (pinchStart.zoom * pinchDistance()) / pinchStart.distance;
    }
    return;
  }
  pan(current.x - previous.x, current.y - previous.y);
};

const endDrag = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  pinchStart = undefined;
};

const zoomByWheel = (event: WheelEvent) => {
  zoom.value = crop.value.zoom * Math.exp(-event.deltaY / 500);
};

const KEY_DIRECTIONS: Partial<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const panByKey = (event: KeyboardEvent) => {
  const direction = KEY_DIRECTIONS[event.key];
  if (!isDefined(direction)) return;
  event.preventDefault();
  pan(direction[0] * KEY_PAN_STEP, direction[1] * KEY_PAN_STEP);
};

const isSaving = ref(false);

const save = async () => {
  isSaving.value = true;
  try {
    emit("save", await exportCrop(props.image, cropRect(props.image, crop.value)));
  } catch (error) {
    console.error(error);
    toast.error("Couldn't prepare that photo");
  } finally {
    isSaving.value = false;
  }
};
</script>
