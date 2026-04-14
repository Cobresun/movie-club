<script setup lang="ts">
import { computed, shallowRef } from "vue";

import { hasElements } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";
import { MovieSearchIndex } from "../../../../lib/types/movie";
import ListItems from "../components/ListItems.vue";
import ManageListsModal from "../components/ManageListsModal.vue";
import { useCollapsedLists } from "../composables/useCollapsedLists";

import MovieSearchPrompt from "@/common/components/MovieSearchPrompt.vue";
import { useClubSlug } from "@/service/useClub";
import {
  BASE_IMAGE_URL,
  ClubListSummary,
  useAddListItem,
  useClubLists,
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

const otherLists = (listId: string) =>
  userLists.value
    .filter((l) => l.id !== listId)
    .map((l) => ({ id: l.id, title: l.title }));

const { isCollapsed, toggle } = useCollapsedLists(clubSlug);

// -- manage lists modal --
const managingLists = shallowRef(false);

// -- add movie (to a specific list) --
const addingToListId = shallowRef<string | null>(null);
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

<template>
  <div class="p-2 text-center">
    <page-header :has-back="true" back-route="ClubHome" page-name="Lists" />
    <loading-spinner v-if="isLoading" />
    <div v-else-if="hasElements(lists)">
      <div class="mb-4 flex flex-wrap items-center justify-center gap-2">
        <v-btn @click="managingLists = true">
          <mdicon name="cog" :size="16" class="mr-1" />
          Manage lists
        </v-btn>
      </div>

      <div class="flex flex-col gap-6">
        <section
          v-for="list in userLists"
          :key="list.id"
          class="rounded-lg border border-slate-700 bg-slate-900/40 p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
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
            <v-btn @click="startAdd(list.id)">+ Add</v-btn>
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
      </div>
    </div>

    <empty-state
      v-else-if="!isLoading"
      header="No lists yet"
      message="Create your first list to get started."
    />

    <v-modal v-if="addingToListId !== null" @close="addingToListId = null">
      <movie-search-prompt
        :default-list="[]"
        default-list-title=""
        @close="addingToListId = null"
        @select-from-search="onAddMovie"
      />
    </v-modal>

    <ManageListsModal
      :show="managingLists"
      :club-slug="clubSlug"
      @close="managingLists = false"
    />
  </div>
</template>
