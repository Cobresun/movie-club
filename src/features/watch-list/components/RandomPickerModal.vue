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
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { onMounted, toRef } from "vue";

import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { useRandomPicker } from "../composables/useRandomPicker";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";

const props = defineProps<{
  watchList: DetailedWorkListItem[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "selected", item: DetailedWorkListItem): void;
}>();

const { currentItem, isRevealed, pick } = useRandomPicker(
  toRef(props, "watchList"),
);

onMounted(async () => {
  const winner = await pick();
  emit("selected", winner);
});
</script>
