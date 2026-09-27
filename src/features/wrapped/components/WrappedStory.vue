<template>
  <section
    class="mx-auto flex w-[min(100%,calc((100dvh-19rem)*9/16))] min-w-[16rem] flex-col gap-3"
    aria-roledescription="carousel"
    :aria-label="`${clubName} Wrapped ${year}`"
  >
    <div class="flex gap-1">
      <button
        v-for="(card, index) in cards"
        :key="card.id"
        type="button"
        class="flex-1 py-1.5"
        :aria-label="`Card ${index + 1}: ${card.label}`"
        :aria-current="index === currentIndex ? 'step' : undefined"
        @click="currentIndex = index"
      >
        <span
          class="block h-1 rounded-full transition-colors duration-base ease-standard"
          :class="index <= currentIndex ? 'bg-white' : 'bg-white/25'"
        />
      </button>
    </div>

    <div
      ref="cardElement"
      class="aspect-[9/16] w-full cursor-pointer touch-pan-y select-none overflow-hidden rounded-2xl shadow-2xl"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="pointerStart = undefined"
    >
      <Transition
        mode="out-in"
        enter-active-class="transition duration-base ease-standard"
        enter-from-class="scale-[0.98] opacity-0"
        leave-active-class="transition duration-fast ease-standard"
        leave-to-class="opacity-0"
      >
        <WrappedCardFrame
          :key="currentCard.id"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${currentIndex + 1} of ${cards.length}: ${currentCard.label}`"
          :tone="currentCard.tone"
          :title="currentCard.label"
          :club-name="clubName"
          :year="year"
        >
          <component :is="currentCard.component" v-bind="currentCard.props" />
        </WrappedCardFrame>
      </Transition>
    </div>

    <div class="flex items-center">
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
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import { renderCardImage } from "../cardImage";
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

const currentIndex = ref(0);
const currentCard = computed(() => props.cards[currentIndex.value]);

const previous = () => {
  currentIndex.value = Math.max(0, currentIndex.value - 1);
};
const next = () => {
  currentIndex.value = Math.min(props.cards.length - 1, currentIndex.value + 1);
};

// Pixels a pointer must travel sideways to count as a swipe, and the most it
// may drift to still count as a tap.
const SWIPE_DISTANCE = 40;
const TAP_SLOP = 10;

const cardElement = ref<HTMLElement>();
const pointerStart = ref<{ x: number; y: number }>();

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  pointerStart.value = { x: event.clientX, y: event.clientY };
};

// Story-style gestures on top of the buttons: swipe either way, or tap the
// left third to go back and anywhere else to go on.
const onPointerUp = (event: PointerEvent) => {
  const start = pointerStart.value;
  pointerStart.value = undefined;
  if (!isDefined(start) || !isDefined(cardElement.value)) return;

  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next();
    else previous();
  } else if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
    const bounds = cardElement.value.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width / 3) previous();
    else next();
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowRight") next();
  else if (event.key === "ArrowLeft") previous();
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const toast = useToast();
const { shareImage, canUseNativeShare } = useShare();
const isSaving = ref(false);

const shareCard = async () => {
  if (!isDefined(cardElement.value)) return;
  isSaving.value = true;
  try {
    const blob = await renderCardImage(cardElement.value);
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
