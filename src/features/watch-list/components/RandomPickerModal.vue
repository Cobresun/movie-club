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
      <div v-if="confirmLabel" class="flex gap-3">
        <v-btn :disabled="!winner" @click="onConfirm">{{ confirmLabel }}</v-btn>
        <v-btn :disabled="!winner" @click="emit('close')">Never Mind</v-btn>
      </div>
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
  } else {
    emit("selected", result);
  }
});
</script>
