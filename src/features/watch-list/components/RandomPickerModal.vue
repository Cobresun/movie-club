<template>
  <v-modal size="sm" @close="emit('close')">
    <div class="flex flex-col items-center gap-4">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-base ease-emphasized"
        enter-from-class="scale-90 opacity-0"
        leave-active-class="transition-opacity duration-fast ease-standard"
        leave-to-class="opacity-0"
      >
        <h2 v-if="isRevealed" key="landed" class="text-xl font-bold">Tonight's pick!</h2>
        <h2 v-else key="spinning" class="text-xl font-bold">Picking a random movie...</h2>
      </Transition>
      <!-- The card itself is never re-keyed per tick (its lazy-loaded poster
           would fade in from nothing every time); the wrapper replays a nudge
           on each tick instead, and pops once it lands. -->
      <div ref="reel" class="flex justify-center" :class="{ 'picker-landed': isRevealed }">
        <WorkPosterCard
          v-if="currentItem"
          :title="currentItem.title"
          :poster-url="currentItem.imageUrl ?? ''"
          :highlighted="isRevealed"
          :loading="false"
          :show-delete="false"
        />
      </div>
      <div v-if="winner" class="animate-fade-up flex flex-col items-center gap-3">
        <div class="flex gap-3">
          <v-btn @click="onMakeNext">Make up next</v-btn>
          <v-btn @click="emit('close')">Never Mind</v-btn>
        </div>
        <select
          v-if="otherLists && otherLists.length > 0"
          class="w-full rounded-md bg-slate-800 px-2 py-1 text-sm text-white"
          @change="(e) => onMoveToList((e.target as HTMLSelectElement).value)"
        >
          <option value="">Move to…</option>
          <option v-for="l in otherLists" :key="l.id" :value="l.id">
            {{ l.title }}
          </option>
        </select>
      </div>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { onMounted, ref, toRef, watch } from "vue";

import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { useRandomPicker } from "../composables/useRandomPicker";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const props = defineProps<{
  items: DetailedWorkListItem[];
  otherLists?: { id: string; title: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "makeNext", item: DetailedWorkListItem): void;
  (e: "moveToList", payload: { item: DetailedWorkListItem; listId: string }): void;
}>();

const { currentItem, isRevealed, pick } = useRandomPicker(toRef(props, "items"));

const winner = ref<DetailedWorkListItem>();

const reel = ref<HTMLElement | null>(null);

// Imperative so back-to-back ticks restart the animation: remove, force a
// reflow, re-add.
watch(currentItem, () => {
  const el = reel.value;
  if (el === null || isRevealed.value) return;
  el.classList.remove("picker-tick");
  void el.offsetWidth;
  el.classList.add("picker-tick");
});

const onMakeNext = () => {
  if (winner.value) {
    emit("makeNext", winner.value);
    emit("close");
  }
};

const onMoveToList = (listId: string) => {
  if (listId !== "" && winner.value) {
    emit("moveToList", { item: winner.value, listId });
    emit("close");
  }
};

onMounted(async () => {
  winner.value = await pick();
});
</script>

<style scoped>
.picker-tick {
  animation: picker-tick 120ms var(--ease-standard);
}

@keyframes picker-tick {
  from {
    transform: translateY(-10px);
    filter: blur(1px);
  }
}

.picker-landed {
  animation: picker-landed 700ms var(--ease-emphasized);
}

@keyframes picker-landed {
  30% {
    transform: scale(1.1) rotate(-2deg);
  }
  55% {
    transform: scale(0.97) rotate(1deg);
  }
  75% {
    transform: scale(1.03);
  }
}
</style>
