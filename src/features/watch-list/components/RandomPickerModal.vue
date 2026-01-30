<template>
  <v-modal size="sm" @close="emit('close')">
    <div class="flex flex-col items-center gap-4">
      <h2 class="text-xl font-bold">Picking a random movie...</h2>
      <div class="flex justify-center">
        <MoviePosterCard
          v-if="currentItem"
          :movie-title="currentItem.title"
          :movie-poster-url="currentItem.imageUrl ?? ''"
          :highlighted="isRevealed"
          :loading="false"
          :show-delete="false"
        />
      </div>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div v-if="showButtons" class="flex gap-3">
          <v-btn @click="onConfirm">{{ confirmLabel }}</v-btn>
          <v-btn @click="emit('close')">Never Mind</v-btn>
        </div>
      </Transition>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { onMounted, ref, toRef } from "vue";

import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { useRandomPicker } from "../composables/useRandomPicker";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";

const props = defineProps<{
  items: DetailedWorkListItem[];
  confirmLabel?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "selected", item: DetailedWorkListItem): void;
}>();

const { currentItem, isRevealed, pick } = useRandomPicker(
  toRef(props, "items"),
);

const showButtons = ref(false);
const winner = ref<DetailedWorkListItem>();

const onConfirm = () => {
  if (winner.value) {
    emit("selected", winner.value);
  }
};

onMounted(async () => {
  const result = await pick();
  if (props.confirmLabel) {
    winner.value = result;
    showButtons.value = true;
  } else {
    emit("selected", result);
  }
});
</script>
