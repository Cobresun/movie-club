<template>
  <div>
    <div v-if="isLoading" class="flex justify-center"><loading-spinner /></div>
    <empty-state
      v-else-if="!items || items.length === 0"
      header="Empty list"
      message="Add movies to this list to see them here."
    />
    <VueDraggableNext
      v-else
      v-model="draggableItems"
      tag="div"
      class="my-4 grid grid-cols-auto justify-items-center gap-4"
      :delay="150"
      :delay-on-touch-only="true"
      :animation="200"
      handle=".drag-handle"
      filter=".no-drag"
      :prevent-on-filter="true"
      :move="onDragMove"
      @end="onDragEnd"
    >
      <div
        v-for="item in draggableItems"
        :key="item.id"
        class="relative"
        :class="{ 'no-drag': item.id === nextWorkId }"
      >
        <MoviePosterCard
          :movie-title="item.title"
          :movie-poster-url="item.imageUrl ?? ''"
          :loading="false"
          :show-delete="true"
          :show-drag-handle="item.id !== nextWorkId"
          :highlighted="item.id === nextWorkId"
          @delete="onDelete(item.id)"
        >
          <div class="mt-2 flex flex-col gap-2">
            <div class="grid grid-cols-2 gap-2">
              <v-btn
                v-if="canReview && listId !== reviewsListId"
                class="flex justify-center"
                :title="'Move to reviews'"
                @click="onReview(item.id)"
              >
                <mdicon name="check" />
              </v-btn>
              <v-btn
                class="flex justify-center"
                :class="{
                  'col-span-2': !(canReview && listId !== reviewsListId),
                }"
                :title="
                  item.id === nextWorkId
                    ? 'Clear next watch'
                    : 'Set as next watch'
                "
                @click="
                  item.id === nextWorkId
                    ? clearNextWork()
                    : onSetNextWatch(item.id)
                "
              >
                <mdicon
                  :name="
                    item.id === nextWorkId
                      ? 'arrow-collapse-down'
                      : 'arrow-collapse-up'
                  "
                />
              </v-btn>
            </div>
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
    </VueDraggableNext>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";
import { useRouter } from "vue-router";

import { hasValue } from "../../../../lib/checks/checks";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import {
  useClearNextWork,
  useDeleteListItem,
  useList,
  useMoveListItem,
  useNextWork,
  useReorderList,
  useSetNextWork,
} from "@/service/useList";

const props = defineProps<{
  clubSlug: string;
  listId: string;
  otherLists: { id: string; title: string }[];
  reviewsListId: string | null;
}>();

const { listId } = toRefs(props);
const { data: items, isLoading } = useList(props.clubSlug, listId);

const canReview = computed(() => hasValue(props.reviewsListId));

const { data: nextWorkId } = useNextWork(props.clubSlug);
const { mutate: setNextWork } = useSetNextWork(props.clubSlug);
const { mutate: clearNextWork } = useClearNextWork(props.clubSlug);
const { mutate: reorderList } = useReorderList(props.clubSlug, props.listId);

// Local mirror for VueDraggableNext — it needs to own the array to mutate it.
const draggableItems = ref<DetailedWorkListItem[]>([]);
watch(
  items,
  (next) => {
    draggableItems.value = next ? [...next] : [];
  },
  { immediate: true },
);

const { mutate: deleteItem } = useDeleteListItem(props.clubSlug, props.listId);
const { mutate: moveItem } = useMoveListItem(props.clubSlug);
const router = useRouter();

const onSetNextWatch = (workId: string) => {
  setNextWork(workId);
  const newOrder = [
    workId,
    ...draggableItems.value.filter((i) => i.id !== workId).map((i) => i.id),
  ];
  reorderList(newOrder);
};

const onDragMove = (evt: { relatedContext: { index: number } }) => {
  if (hasValue(nextWorkId.value) && evt.relatedContext.index === 0)
    return false;
};

const onDragEnd = () => {
  reorderList(draggableItems.value.map((i) => i.id));
};

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
  moveItem(
    {
      sourceListId: props.listId,
      destinationListId: props.reviewsListId,
      workId,
    },
    {
      onSuccess: () => {
        router.push({ name: "Reviews" }).catch(console.error);
      },
    },
  );
};
</script>
