<template>
  <section
    class="flex flex-col gap-3"
    aria-roledescription="carousel"
    :aria-label="`${clubName} Wrapped ${year}`"
  >
    <div class="mx-auto flex max-w-full gap-1" :style="{ width: `${displayWidth}px` }">
      <button
        v-for="(card, index) in cards"
        :key="card.id"
        type="button"
        class="flex-1 py-1.5"
        :aria-label="`Card ${index + 1}: ${card.label}`"
        :aria-current="index === currentIndex ? 'step' : undefined"
        @click="jumpTo(index)"
      >
        <span
          class="block h-1 rounded-full transition-colors duration-base ease-standard"
          :class="index <= currentIndex ? 'bg-white' : 'bg-white/25'"
        />
      </button>
    </div>

    <div ref="stage" class="flex min-h-0 flex-1 items-center justify-center">
      <div
        ref="cardViewport"
        class="relative isolate shrink-0 cursor-pointer touch-pan-y select-none overflow-hidden rounded-2xl bg-black shadow-2xl"
        :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <div
          class="absolute left-0 top-0 origin-top-left"
          :style="{
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
            transform: `scale(${scale})`,
            perspective: `${PERSPECTIVE}px`,
          }"
        >
          <div
            class="absolute inset-0"
            :style="{
              transformStyle: 'preserve-3d',
              transform: `translateZ(-${CARD_WIDTH / 2}px) rotateY(${angle}deg)`,
              transition: settleTransition,
            }"
          >
            <div
              v-for="face in faces"
              :key="face.card.id"
              :ref="(element) => setFaceElement(face.offset, element)"
              class="absolute inset-0"
              :style="{
                backfaceVisibility: 'hidden',
                transform: `rotateY(${face.offset * 90}deg) translateZ(${CARD_WIDTH / 2}px)`,
              }"
              :aria-hidden="face.offset === 0 ? undefined : 'true'"
              :inert="face.offset !== 0"
            >
              <WrappedCardFrame
                :role="face.offset === 0 ? 'group' : undefined"
                :aria-roledescription="face.offset === 0 ? 'slide' : undefined"
                :aria-label="
                  face.offset === 0
                    ? `${currentIndex + 1} of ${cards.length}: ${face.card.label}`
                    : undefined
                "
                :tone="face.card.tone"
                :title="face.card.label"
                :club-name="clubName"
                :year="year"
              >
                <component :is="face.card.component" v-bind="face.card.props" />
              </WrappedCardFrame>
              <div
                class="pointer-events-none absolute inset-0 bg-black"
                :style="{ opacity: shade(face.offset), transition: settleTransition }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto flex max-w-full items-center" :style="{ width: `${displayWidth}px` }">
      <button
        type="button"
        class="rounded-full p-1.5 text-white transition hover:bg-white/10 disabled:opacity-30"
        aria-label="Previous card"
        :disabled="currentIndex === 0"
        @click="previous"
      >
        <mdicon name="chevron-left" :size="32" />
      </button>
      <v-btn class="mx-auto min-h-[44px] px-3" :disabled="isSaving" @click="shareCard">
        <mdicon
          :name="canUseNativeShare() ? 'share-variant' : 'download'"
          :size="20"
          class="mr-2"
        />
        {{ isSaving ? "Preparing image…" : canUseNativeShare() ? "Share card" : "Save card" }}
      </v-btn>
      <button
        type="button"
        class="rounded-full p-1.5 text-white transition hover:bg-white/10 disabled:opacity-30"
        aria-label="Next card"
        :disabled="currentIndex === cards.length - 1"
        @click="next"
      >
        <mdicon name="chevron-right" :size="32" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import { CARD_HEIGHT, CARD_WIDTH, renderCardImage } from "../cardImage";
import type { WrappedCard } from "../wrappedDeck";
import WrappedCardFrame from "./WrappedCardFrame.vue";
import { useShare } from "@/common/composables/useShare";

const props = defineProps<{
  cards: WrappedCard[];
  clubName: string;
  year: number;
  /** File name stem for saved images; the card id is appended. */
  fileName: string;
}>();

// Largest the card may grow on a big screen before it stops reading as a story.
const MAX_SCALE = 1.4;

const stage = ref<HTMLElement>();
const scale = ref(1);
const displayWidth = computed(() => CARD_WIDTH * scale.value);
const displayHeight = computed(() => CARD_HEIGHT * scale.value);

let stageObserver: ResizeObserver | undefined;

onMounted(() => {
  if (typeof ResizeObserver === "undefined" || !isDefined(stage.value)) return;
  stageObserver = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width === 0 || height === 0) return;
    scale.value = Math.min(width / CARD_WIDTH, height / CARD_HEIGHT, MAX_SCALE);
  });
  stageObserver.observe(stage.value);
});

// --- The cube ---------------------------------------------------------------
// Cards sit on the faces of a cube, stories-style: the current card faces the
// viewer and its neighbours wait on the side faces. Turning the cube by a
// quarter brings a neighbour round; dragging turns it with the finger.

/** Camera distance, in card pixels. Smaller exaggerates the turn. */
const PERSPECTIVE = 1000;
const SETTLE_MS = 400;
/** How far through a turn (0–1) a release commits to it rather than springing back. */
const COMMIT_PROGRESS = 0.25;
/** Release speed (px/ms) that counts as a flick, committing however short the drag. */
const FLICK_VELOCITY = 0.5;
/** How much a drag past the first or last card still turns, as a fraction. */
const EDGE_RESISTANCE = 0.2;
// Pixels a pointer may drift and still count as a tap.
const TAP_SLOP = 10;

type Direction = -1 | 0 | 1;

const currentIndex = ref(0);
const currentCard = computed(() => props.cards[currentIndex.value]);
/** The cube's turn in degrees; -90 shows the next card, 90 the previous. */
const angle = ref(0);
const isSettling = ref(false);
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let settleDirection: Direction = 0;

const faces = computed(() =>
  ([-1, 0, 1] as const)
    .map((offset) => ({ offset, card: props.cards.at(currentIndex.value + offset) }))
    .filter(
      (face): face is { offset: -1 | 0 | 1; card: WrappedCard } =>
        isDefined(face.card) && currentIndex.value + face.offset >= 0,
    ),
);

const settleTransition = computed(() =>
  isSettling.value ? `all ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : "none",
);

/** Side faces darken as they turn away, the way light falls on a real cube. */
const shade = (offset: number): number =>
  Math.min(1, Math.abs(offset * 90 + angle.value) / 90) * 0.6;

const hasNeighbour = (direction: Direction): boolean => {
  const target = currentIndex.value + direction;
  return target >= 0 && target < props.cards.length;
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lands whatever turn is in flight, so a new one starts from rest. */
const finishSettling = () => {
  if (!isSettling.value) return;
  clearTimeout(settleTimer);
  currentIndex.value += settleDirection;
  angle.value = 0;
  isSettling.value = false;
};

/** Turns the cube to a neighbour (or back to rest for 0) and lands on it. */
const settle = (direction: Direction) => {
  finishSettling();
  if (!hasNeighbour(direction)) direction = 0;
  if (prefersReducedMotion()) {
    currentIndex.value += direction;
    angle.value = 0;
    return;
  }
  settleDirection = direction;
  isSettling.value = true;
  angle.value = -direction * 90;
  settleTimer = setTimeout(finishSettling, SETTLE_MS);
};

const previous = () => settle(-1);
const next = () => settle(1);

const jumpTo = (index: number) => {
  finishSettling();
  currentIndex.value = index;
};

// --- Gestures ---------------------------------------------------------------

const cardViewport = ref<HTMLElement>();
let gesture: { x: number; y: number; time: number; dragging: boolean } | undefined;

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  finishSettling();
  gesture = { x: event.clientX, y: event.clientY, time: event.timeStamp, dragging: false };
};

const onPointerMove = (event: PointerEvent) => {
  if (!isDefined(gesture)) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.dragging) {
    if (Math.abs(dx) < TAP_SLOP || Math.abs(dx) < Math.abs(dy)) return;
    gesture.dragging = true;
    cardViewport.value?.setPointerCapture(event.pointerId);
  }
  const progress = Math.max(-1, Math.min(1, dx / displayWidth.value));
  const towards: Direction = progress < 0 ? 1 : -1;
  angle.value = progress * 90 * (hasNeighbour(towards) ? 1 : EDGE_RESISTANCE);
};

const onPointerUp = (event: PointerEvent) => {
  const start = gesture;
  gesture = undefined;
  if (!isDefined(start) || !isDefined(cardViewport.value)) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;

  if (start.dragging) {
    const velocity = dx / Math.max(1, event.timeStamp - start.time);
    const committed =
      Math.abs(dx) / displayWidth.value > COMMIT_PROGRESS || Math.abs(velocity) > FLICK_VELOCITY;
    settle(committed ? (dx < 0 ? 1 : -1) : 0);
  } else if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
    // Tap the left third to go back, anywhere else to go on.
    const bounds = cardViewport.value.getBoundingClientRect();
    settle(event.clientX - bounds.left < bounds.width / 3 ? -1 : 1);
  }
};

const onPointerCancel = () => {
  if (gesture?.dragging === true) settle(0);
  gesture = undefined;
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowRight") next();
  else if (event.key === "ArrowLeft") previous();
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  stageObserver?.disconnect();
  clearTimeout(settleTimer);
});

// --- Saving -----------------------------------------------------------------

const currentFace = ref<HTMLElement>();
const setFaceElement = (offset: number, element: unknown) => {
  if (offset === 0 && element instanceof HTMLElement) currentFace.value = element;
};

const toast = useToast();
const { shareImage, canUseNativeShare } = useShare();
const isSaving = ref(false);

const shareCard = async () => {
  finishSettling();
  await nextTick();
  if (!isDefined(currentFace.value)) return;
  isSaving.value = true;
  try {
    const blob = await renderCardImage(currentFace.value);
    await shareImage({
      blob,
      fileName: `${props.fileName}-${currentCard.value.id}.png`,
      title: `${props.clubName} Wrapped ${props.year}`,
    });
  } catch (error) {
    console.error(error);
    toast.error("Couldn't turn this card into an image");
  } finally {
    isSaving.value = false;
  }
};
</script>
