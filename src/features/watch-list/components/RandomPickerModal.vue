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
      <div v-if="winner" class="flex flex-col items-center gap-3">
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
import { onMounted, ref, toRef } from "vue";

import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { useRandomPicker } from "../composables/useRandomPicker";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";

const props = defineProps<{
  items: DetailedWorkListItem[];
  otherLists?: { id: string; title: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "makeNext", item: DetailedWorkListItem): void;
  (
    e: "moveToList",
    payload: { item: DetailedWorkListItem; listId: string },
  ): void;
}>();

const { currentItem, isRevealed, pick } = useRandomPicker(
  toRef(props, "items"),
);

const winner = ref<DetailedWorkListItem>();

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
