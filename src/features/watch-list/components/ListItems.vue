<template>
  <div>
    <RandomPickerModal
      v-if="randomPickerOpen"
      :items="draggableItems"
      :other-lists="otherLists"
      @close="randomPickerOpen = false"
      @make-next="onMakeNext"
      @move-to-list="onMoveToList"
    />
    <div v-if="isLoading" class="flex justify-center"><loading-spinner /></div>
    <empty-state
      v-else-if="!items || items.length === 0"
      title="Empty list"
      description="Add items to this list to see them here."
    />
    <template v-else>
      <div class="w-full">
        <VueDraggableNext
          v-model="draggableItems"
          tag="div"
          class="my-4 grid grid-cols-auto justify-items-center gap-4"
          :delay="150"
          :delay-on-touch-only="true"
          :animation="200"
          handle=".drag-handle"
          filter=".no-drag"
          :prevent-on-filter="false"
          :move="onDragMove"
          @end="onDragEnd"
        >
          <div
            v-for="item in draggableItems"
            :key="item.id"
            class="relative"
            :class="{ 'no-drag': item.id === nextWorkId }"
          >
            <WorkPosterCard
              :title="item.title"
              :poster-url="item.imageUrl ?? ''"
              :loading="isPending(item.id)"
              :show-drag-handle="item.id !== nextWorkId && !isPending(item.id)"
              :highlighted="item.id === nextWorkId"
              :selectable="!isPending(item.id)"
              @select="emit('select', item.id)"
            >
              <div class="mt-2 flex flex-col gap-2">
                <div
                  v-if="isDefined(adderFor(item))"
                  class="flex items-center justify-center gap-1.5 text-xs text-slate-400"
                  :title="`Added by ${adderFor(item)?.name}`"
                >
                  <VAvatar
                    :src="adderFor(item)?.image"
                    :name="adderFor(item)?.name ?? ''"
                    :size="18"
                  />
                  <span class="truncate">{{ adderFor(item)?.name }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <v-btn
                    v-if="canReview && listId !== reviewsListId"
                    class="flex justify-center"
                    :disabled="isPending(item.id)"
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
                    :disabled="isPending(item.id)"
                    :title="
                      item.id === nextWorkId
                        ? 'Clear next up'
                        : 'Set as next up'
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
              </div>
            </WorkPosterCard>
          </div>
        </VueDraggableNext>
      </div>
      <ListItemDetailsDrawer
        v-if="isDefined(selectedItem)"
        :movie="selectedItem"
        :club-slug="props.clubSlug"
        :is-next-work="selectedItem.id === nextWorkId"
        :can-review="canReview && listId !== reviewsListId"
        :other-lists="otherLists"
        :added-by-member="adderFor(selectedItem)"
        @close="emit('deselect')"
        @review="
          onReview(selectedItem.id);
          emit('deselect');
        "
        @set-next-work="onSetNextWatch(selectedItem.id)"
        @clear-next-work="clearNextWork()"
        @delete="
          onDelete(selectedItem.id);
          emit('deselect');
        "
        @move-to-list="(destId) => onMoveFromDrawer(destId)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";
import { useRouter } from "vue-router";

import ListItemDetailsDrawer from "./ListItemDetailsDrawer.vue";
import RandomPickerModal from "./RandomPickerModal.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks";
import { Member } from "../../../../lib/types/club";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import VAvatar from "@/common/components/VAvatar.vue";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import {
  OPTIMISTIC_WORK_ID,
  useClearNextWork,
  useDeleteListItem,
  useList,
  useMoveListItem,
  useNextWork,
  useReorderList,
  useSetNextWork,
} from "@/service/useList";

// A freshly-added item is optimistic until the add settles and the list
// refetches with its real id; acting on it would send "temp" as a work id.
const isPending = (workId: string) => workId === OPTIMISTIC_WORK_ID;

const props = defineProps<{
  clubSlug: string;
  listId: string;
  otherLists: { id: string; title: string }[];
  members: Member[];
  reviewsListId: string | null;
  randomPickerOpen?: boolean;
  selectedItemId: string | null;
  visibleIds?: Set<string> | null;
}>();

const emit = defineEmits<{
  "update:randomPickerOpen": [value: boolean];
  select: [workId: string];
  deselect: [];
}>();

const { listId } = toRefs(props);
const { data: items, isLoading } = useList(props.clubSlug, listId);

const canReview = computed(() => hasValue(props.reviewsListId));

const memberById = computed(() => new Map(props.members.map((m) => [m.id, m])));
const adderFor = (item: DetailedWorkListItem) =>
  hasValue(item.addedBy) ? memberById.value.get(item.addedBy) : undefined;

const { data: nextWorkId } = useNextWork(props.clubSlug);
const { mutate: setNextWork } = useSetNextWork(props.clubSlug);
const { mutate: clearNextWork } = useClearNextWork(props.clubSlug);
const { mutate: reorderList } = useReorderList(props.clubSlug, props.listId);

// Local mirror for VueDraggableNext — it needs to own the array to mutate it.
// When filters are active, visibleIds is the set of matching work ids (computed
// across all lists by the shared SearchFilterBar); null means show everything.
// Partial reorders on a filtered set are handled correctly by the server.
const draggableItems = ref<DetailedWorkListItem[]>([]);
watch(
  [items, () => props.visibleIds],
  ([next, visibleIds]) => {
    const all = next ? [...next] : [];
    draggableItems.value = visibleIds
      ? all.filter((i) => visibleIds.has(i.id))
      : all;
  },
  { immediate: true },
);

const { mutate: deleteItem } = useDeleteListItem(props.clubSlug, props.listId);
const { mutate: moveItem } = useMoveListItem(props.clubSlug);
const router = useRouter();

const onSetNextWatch = (workId: string) => {
  if (isPending(workId)) return;
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
  if (isPending(workId)) return;
  deleteItem(workId);
};

const onMove = (workId: string, destinationListId: string) => {
  if (destinationListId === "" || isPending(workId)) return;
  moveItem({
    sourceListId: props.listId,
    destinationListId,
    workId,
  });
};

const randomPickerOpen = computed({
  get: () => props.randomPickerOpen ?? false,
  set: (val) => emit("update:randomPickerOpen", val),
});

const selectedItem = computed(() =>
  props.selectedItemId === null
    ? undefined
    : draggableItems.value.find((i) => i.id === props.selectedItemId),
);

const onMoveFromDrawer = (destinationListId: string) => {
  if (selectedItem.value === undefined) return;
  onMove(selectedItem.value.id, destinationListId);
  emit("deselect");
};

const onMakeNext = (item: DetailedWorkListItem) => {
  onSetNextWatch(item.id);
  randomPickerOpen.value = false;
};

const onMoveToList = ({
  item,
  listId,
}: {
  item: DetailedWorkListItem;
  listId: string;
}) => {
  onMove(item.id, listId);
  randomPickerOpen.value = false;
};

const onReview = (workId: string) => {
  if (props.reviewsListId === null || isPending(workId)) return;
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
