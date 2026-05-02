<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { useToast } from "vue-toastification";

import { hasElements } from "../../../../lib/checks/checks";
import AddMovieModal from "../components/AddMovieModal.vue";
import ListItems from "../components/ListItems.vue";
import ManageListsModal from "../components/ManageListsModal.vue";
import { useCollapsedLists } from "../composables/useCollapsedLists";

import { useClubSlug } from "@/service/useClub";
import { ClubListSummary, useClubLists } from "@/service/useList";

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

const toast = useToast();
const shareList = async (listId: string) => {
  const url = `${window.location.origin}/share/club/${clubSlug}/list/${listId}`;
  await navigator.clipboard.writeText(url);
  toast.success("List link copied to clipboard!");
};
</script>

<template>
  <div class="p-2 text-center">
    <page-header
      :has-back="true"
      back-route="ClubHome"
      page-name="Watchlists"
    />
    <loading-spinner v-if="isLoading" />
    <template v-else-if="hasElements(userLists)">
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
            <div class="flex flex-shrink-0 items-center gap-2">
              <v-btn
                title="Share list"
                aria-label="Share list"
                @click="shareList(list.id)"
              >
                <mdicon name="share-variant" :size="16" />
              </v-btn>
              <v-btn @click="startAdd(list.id)">+ Add</v-btn>
            </div>
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
    </template>

    <empty-state
      v-else
      title="No lists yet"
      description="Create your first list to get started."
      action-label="Create list"
      @action="managingLists = true"
    />

    <v-modal
      v-if="addingToListId !== null"
      size="lg"
      @close="addingToListId = null"
    >
      <AddMovieModal
        :key="addingToListId"
        :list-id="addingToListId"
        @close="addingToListId = null"
      />
    </v-modal>

    <ManageListsModal
      :show="managingLists"
      :club-slug="clubSlug"
      @close="managingLists = false"
    />
  </div>
</template>
