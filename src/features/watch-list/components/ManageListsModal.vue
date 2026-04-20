<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";

import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import {
  ClubListSummary,
  useClubLists,
  useCreateList,
  useDeleteList,
  useRenameList,
  useReorderClubLists,
} from "@/service/useList";

const props = defineProps<{
  show: boolean;
  clubSlug: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { data: lists } = useClubLists(props.clubSlug, { includeSystem: false });

// Local mirror for VueDraggableNext — it needs to own the array to mutate it.
const draggableLists = ref<ClubListSummary[]>([]);
watch(
  () => lists.value ?? [],
  (next) => {
    draggableLists.value = [...next];
  },
  { immediate: true },
);

// -- reorder --
const { mutate: reorderClubLists } = useReorderClubLists(props.clubSlug);
const onListsReordered = () => {
  reorderClubLists(draggableLists.value.map((l) => l.id));
};

// -- create --
const newListTitle = shallowRef("");
const { mutate: createList } = useCreateList(props.clubSlug);
const confirmCreateList = () => {
  const title = newListTitle.value.trim();
  if (title === "") return;
  createList(title);
  newListTitle.value = "";
};

// -- rename --
const renamingListId = shallowRef<string | null>(null);
const renameTitle = shallowRef("");
const { mutate: renameList } = useRenameList(props.clubSlug);
const startRename = (list: ClubListSummary) => {
  renamingListId.value = list.id;
  renameTitle.value = list.title;
};
const confirmRename = (listId: string) => {
  const title = renameTitle.value.trim();
  if (title === "") return;
  renameList({ listId, title });
  renamingListId.value = null;
};
const cancelRename = () => {
  renamingListId.value = null;
};

// -- delete --
const deletingListId = shallowRef<string | null>(null);
const { mutate: deleteList } = useDeleteList(props.clubSlug);
const confirmDeleteList = () => {
  if (deletingListId.value === null) return;
  deleteList(deletingListId.value);
  deletingListId.value = null;
};
</script>

<template>
  <v-modal v-if="show" size="default" z-index="50" @close="emit('close')">
    <div class="flex flex-col gap-4">
      <h2 class="text-xl font-bold text-white">Manage Lists</h2>

      <!-- Create new list -->
      <div class="flex items-center gap-2">
        <input
          v-model="newListTitle"
          class="min-w-0 flex-1 rounded-md border-2 border-slate-600 bg-background p-2 text-sm text-white outline-none focus:border-primary"
          placeholder="New list name…"
          @keyup.enter="confirmCreateList"
        />
        <v-btn
          :disabled="newListTitle.trim() === ''"
          @click="confirmCreateList"
        >
          + Create
        </v-btn>
      </div>

      <!-- Draggable list rows -->
      <VueDraggableNext
        v-model="draggableLists"
        tag="div"
        class="flex flex-col gap-2"
        handle=".list-drag-handle"
        :animation="200"
        @end="onListsReordered"
      >
        <div
          v-for="list in draggableLists"
          :key="list.id"
          class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3"
        >
          <span
            class="list-drag-handle cursor-grab text-slate-400 hover:text-slate-200"
            title="Drag to reorder"
            >⋮⋮</span
          >

          <template v-if="renamingListId === list.id">
            <input
              v-model="renameTitle"
              class="min-w-0 flex-1 rounded-md border-2 border-slate-600 bg-background p-1 text-sm text-white outline-none focus:border-primary"
              @keyup.enter="confirmRename(list.id)"
              @keyup.escape="cancelRename"
            />
            <v-btn
              :disabled="renameTitle.trim() === ''"
              @click="confirmRename(list.id)"
            >
              Save
            </v-btn>
            <v-btn @click="cancelRename">Cancel</v-btn>
          </template>
          <template v-else>
            <span class="min-w-0 flex-1 truncate text-white">{{
              list.title
            }}</span>
            <span class="shrink-0 text-sm text-slate-400"
              >({{ list.itemCount }})</span
            >
            <button
              class="shrink-0 text-slate-400 hover:text-white"
              title="Rename"
              @click="startRename(list)"
            >
              <mdicon name="pencil" :size="18" />
            </button>
            <button
              class="shrink-0 text-slate-400 hover:text-red-400"
              title="Delete"
              @click="deletingListId = list.id"
            >
              <mdicon name="trash-can-outline" :size="18" />
            </button>
          </template>
        </div>
      </VueDraggableNext>
    </div>
  </v-modal>

  <!-- Stacks above the manage modal via its own z-index="60" -->
  <DeleteConfirmationModal
    :show="deletingListId !== null"
    title="Delete list"
    message="Are you sure? Movies on this list will not be deleted from the club."
    @cancel="deletingListId = null"
    @confirm="confirmDeleteList"
  />
</template>
