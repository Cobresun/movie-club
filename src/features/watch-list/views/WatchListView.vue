<template>
  <div class="p-2 text-center">
    <page-header :has-back="true" back-route="ClubHome" page-name="Lists" />
    <loading-spinner v-if="isLoading" />
    <div v-else-if="hasElements(lists)">
      <div class="mb-4 flex flex-wrap items-center justify-center gap-2">
        <v-btn @click="creatingList = true">+ New list</v-btn>
      </div>

      <div
        v-if="creatingList"
        class="mb-4 flex items-center justify-center gap-2"
      >
        <input
          v-model="newListTitle"
          class="rounded-md border-2 border-slate-600 bg-background p-2 text-sm text-white outline-none focus:border-primary"
          placeholder="List name"
          @keyup.enter="confirmCreateList"
        />
        <v-btn
          :disabled="newListTitle.trim() === ''"
          @click="confirmCreateList"
        >
          Create
        </v-btn>
        <v-btn @click="cancelCreateList">Cancel</v-btn>
      </div>

      <VueDraggableNext
        v-model="draggableLists"
        tag="div"
        class="flex flex-col gap-6"
        handle=".list-drag-handle"
        :animation="200"
        @end="onListsReordered"
      >
        <section
          v-for="list in draggableLists"
          :key="list.id"
          class="rounded-lg border border-slate-700 bg-slate-900/40 p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="list-drag-handle cursor-grab text-slate-400 hover:text-slate-200"
                title="Drag to reorder"
              >
                ⋮⋮
              </span>
              <button
                class="text-slate-200 hover:text-primary"
                :aria-label="
                  isCollapsed(list.id) ? 'Expand list' : 'Collapse list'
                "
                @click="toggle(list.id)"
              >
                {{ isCollapsed(list.id) ? "▶" : "▼" }}
              </button>
              <h2 class="truncate text-lg font-semibold text-white">
                {{ list.title }}
              </h2>
              <span class="text-sm text-slate-400">
                ({{ list.itemCount }})
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <v-btn @click="startAdd(list.id)">+ Add</v-btn>
              <v-btn @click="startRename(list)">Rename</v-btn>
              <v-btn @click="startDelete(list.id)">Delete</v-btn>
            </div>
          </div>

          <div
            v-if="renamingListId === list.id"
            class="mt-2 flex items-center justify-center gap-2"
          >
            <input
              v-model="renameTitle"
              class="rounded-md border-2 border-slate-600 bg-background p-2 text-sm text-white outline-none focus:border-primary"
              placeholder="New name"
              @keyup.enter="confirmRename(list.id)"
            />
            <v-btn
              :disabled="renameTitle.trim() === ''"
              @click="confirmRename(list.id)"
            >
              Save
            </v-btn>
            <v-btn @click="renamingListId = null">Cancel</v-btn>
          </div>

          <div v-show="!isCollapsed(list.id)">
            <ListItems
              :club-slug="clubSlug"
              :list-id="list.id"
              :other-lists="otherLists(list.id)"
              :reviews-list-id="reviewsListId"
            />
          </div>
        </section>
      </VueDraggableNext>
    </div>

    <empty-state
      v-else-if="!isLoading"
      header="No lists yet"
      message="Create your first list to start adding movies."
    />

    <v-modal v-if="addingToListId !== null" @close="addingToListId = null">
      <movie-search-prompt
        :default-list="[]"
        default-list-title=""
        @close="addingToListId = null"
        @select-from-search="onAddMovie"
      />
    </v-modal>

    <DeleteConfirmationModal
      :show="deletingListId !== null"
      title="Delete list"
      message="Are you sure? Movies on this list will not be deleted from the club."
      @cancel="deletingListId = null"
      @confirm="confirmDeleteList"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { VueDraggableNext } from "vue-draggable-next";

import { hasElements } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import ListItems from "../components/ListItems.vue";
import { useCollapsedLists } from "../composables/useCollapsedLists";

import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { useClubSlug } from "@/service/useClub";
import {
  BASE_IMAGE_URL,
  ClubListSummary,
  useAddListItem,
  useClubLists,
  useCreateList,
  useDeleteList,
  useRenameList,
  useReorderClubLists,
} from "@/service/useList";

const clubSlug = useClubSlug();
const { data: lists, isLoading } = useClubLists(clubSlug, {
  includeSystem: true,
});

// Only user lists show in the UI; the reviews list is resolved separately so
// the per-item "Review" button knows its destination.
const userLists = computed<ClubListSummary[]>(() =>
  (lists.value ?? []).filter((l) => l.systemType === null),
);
const reviewsListId = computed<string | null>(
  () => lists.value?.find((l) => l.systemType === "reviews")?.id ?? null,
);

// Local mirror for drag-and-drop.
const draggableLists = ref<ClubListSummary[]>([]);
watch(
  userLists,
  (next) => {
    draggableLists.value = [...next];
  },
  { immediate: true },
);

const otherLists = (listId: string) =>
  userLists.value
    .filter((l) => l.id !== listId)
    .map((l) => ({ id: l.id, title: l.title }));

const { isCollapsed, toggle } = useCollapsedLists(clubSlug);

// -- reorder lists --
const { mutate: reorderClubLists } = useReorderClubLists(clubSlug);
const onListsReordered = () => {
  reorderClubLists(draggableLists.value.map((l) => l.id));
};

// -- create --
const creatingList = ref(false);
const newListTitle = ref("");
const { mutate: createList } = useCreateList(clubSlug);
const confirmCreateList = () => {
  const title = newListTitle.value.trim();
  if (title === "") return;
  createList(title);
  cancelCreateList();
};
const cancelCreateList = () => {
  creatingList.value = false;
  newListTitle.value = "";
};

// -- rename --
const renamingListId = ref<string | null>(null);
const renameTitle = ref("");
const { mutate: renameList } = useRenameList(clubSlug);
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

// -- delete list --
const deletingListId = ref<string | null>(null);
const { mutate: deleteList } = useDeleteList(clubSlug);
const startDelete = (listId: string) => {
  deletingListId.value = listId;
};
const confirmDeleteList = () => {
  if (deletingListId.value === null) return;
  deleteList(deletingListId.value);
  deletingListId.value = null;
};

// -- add movie (to a specific list) --
const addingToListId = ref<string | null>(null);
const startAdd = (listId: string) => {
  addingToListId.value = listId;
};
// The add mutation is bound to whichever list the user opened the modal on.
// Using a computed keeps it reactive if the user opens a different list's
// modal on the same page without a remount.
const addItemMutation = computed(() =>
  useAddListItem(clubSlug, addingToListId.value ?? ""),
);
const onAddMovie = (movie: MovieSearchIndex) => {
  if (addingToListId.value === null) return;
  addItemMutation.value.mutate({
    type: WorkType.movie,
    title: movie.title,
    externalId: movie.id.toString(),
    imageUrl: `${BASE_IMAGE_URL}${movie.poster_path}`,
  });
  addingToListId.value = null;
};
</script>
