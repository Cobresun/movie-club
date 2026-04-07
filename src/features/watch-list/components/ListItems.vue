<template>
  <div>
    <div v-if="isLoading" class="flex justify-center"><loading-spinner /></div>
    <empty-state
      v-else-if="!items || items.length === 0"
      header="Empty list"
      message="Add movies to this list to see them here."
    />
    <div v-else class="my-4 grid grid-cols-auto justify-items-center gap-4">
      <div v-for="item in items" :key="item.id" class="relative">
        <MoviePosterCard
          :movie-title="item.title"
          :movie-poster-url="item.imageUrl ?? ''"
          :loading="false"
          :show-delete="true"
          @delete="onDelete(item.id)"
        >
          <div class="mt-2 flex flex-col gap-2">
            <button
              v-if="canReview && listId !== reviewsListId"
              class="rounded-md bg-primary px-2 py-1 text-sm text-white hover:brightness-110"
              title="Move to reviews"
              @click="onReview(item.id)"
            >
              Review
            </button>
            <select
              v-if="otherLists.length > 0"
              class="w-full rounded-md bg-slate-800 px-2 py-1 text-sm text-white"
              @change="
                (e) => onMove(item.id, (e.target as HTMLSelectElement).value)
              "
            >
              <option value="">Move to…</option>
              <option v-for="l in otherLists" :key="l.id" :value="l.id">
                {{ l.title }}
              </option>
            </select>
          </div>
        </MoviePosterCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs } from "vue";

import { hasValue } from "../../../../lib/checks/checks";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { useDeleteListItem, useList, useMoveListItem } from "@/service/useList";

const props = defineProps<{
  clubSlug: string;
  listId: string;
  otherLists: { id: string; title: string }[];
  reviewsListId: string | null;
}>();

const { listId } = toRefs(props);
const { data: items, isLoading } = useList(props.clubSlug, listId);

const canReview = computed(() => hasValue(props.reviewsListId));

const { mutate: deleteItem } = useDeleteListItem(props.clubSlug, props.listId);
const { mutate: moveItem } = useMoveListItem(props.clubSlug);

const onDelete = (workId: string) => {
  deleteItem(workId);
};

const onMove = (workId: string, destinationListId: string) => {
  if (destinationListId === "") return;
  moveItem({
    sourceListId: props.listId,
    destinationListId,
    workId,
  });
};

const onReview = (workId: string) => {
  if (props.reviewsListId === null) return;
  moveItem({
    sourceListId: props.listId,
    destinationListId: props.reviewsListId,
    workId,
  });
};
</script>
