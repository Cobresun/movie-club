<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { useToast } from "vue-toastification";

import { hasElements } from "../../../../lib/checks/checks";
import AddMovieModal from "../components/AddMovieModal.vue";
import ListItems from "../components/ListItems.vue";
import ManageListsModal from "../components/ManageListsModal.vue";
import { useCollapsedLists } from "../composables/useCollapsedLists";

import { useClubSlug } from "@/service/useClub";
import {
  ClubListSummary,
  useClubLists,
  useReviewsListId,
} from "@/service/useList";

const clubSlug = useClubSlug();
const { data: lists, isLoading } = useClubLists(clubSlug);
const { data: reviewsListIdData } = useReviewsListId(clubSlug);

const userLists = computed<ClubListSummary[]>(() => lists.value ?? []);
const reviewsListId = computed<string | null>(
  () => reviewsListIdData.value ?? null,
);

const otherLists = (listId: string) =>
  userLists.value
    .filter((l) => l.id !== listId)
    .map((l) => ({ id: l.id, title: l.title }));

const { isCollapsed, toggle } = useCollapsedLists(clubSlug);

// -- single selected item across all lists --
const selectedInfo = shallowRef<{ listId: string; workId: string } | null>(
  null,
);

// -- manage lists modal --
const managingLists = shallowRef(false);

// -- add movie (to a specific list) --
const addingToListId = shallowRef<string | null>(null);
const randomOpenListId = shallowRef<string | null>(null);
const startAdd = (listId: string) => {
  addingToListId.value = listId;
};

// -- search --
const searchTerm = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLElement | null>(null);

const searchInputFocusIn = () => {
  if (searchInputSlash.value) searchInputSlash.value.style.display = "none";
};
const searchInputFocusOut = () => {
  if (searchInputSlash.value) searchInputSlash.value.style.display = "";
};

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key === "/") {
    if (searchInput.value === document.activeElement) return;
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});
onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

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
        <div class="relative">
          <mdicon
            name="magnify"
            class="absolute left-8 top-1/2 -translate-y-1/2 transform text-slate-200"
          />
          <input
            ref="searchInput"
            v-model="searchTerm"
            class="w-11/12 rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
            placeholder="Search"
            @focusin="searchInputFocusIn"
            @focusout="searchInputFocusOut"
          />
          <div
            ref="searchInputSlash"
            class="absolute right-8 top-1/2 -translate-y-1/2 transform rounded-md border-2 border-slate-600 px-2 py-1"
          >
            <p class="text-xs text-slate-200">/</p>
          </div>
        </div>
        <v-btn @click="managingLists = true">
          <mdicon name="cog" :size="16" class="mr-1" />
          Manage lists
        </v-btn>
      </div>

      <div class="flex flex-col gap-6">
        <section
          v-for="list in userLists"
          :key="list.id"
          class="rounded-lg border border-slate-700 bg-slate-900/40 p-2 sm:p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <v-btn
                :aria-label="
                  isCollapsed(list.id) ? 'Expand list' : 'Collapse list'
                "
                @click="toggle(list.id)"
              >
                <mdicon
                  :name="
                    isCollapsed(list.id) ? 'chevron-right' : 'chevron-down'
                  "
                  :size="16"
                />
              </v-btn>
              <h2 class="truncate text-lg font-semibold text-white">
                {{ list.title }}
              </h2>
              <span class="text-sm text-slate-400">
                ({{ list.itemCount }})
              </span>
            </div>
            <div class="flex flex-shrink-0 items-center gap-2">
              <v-btn
                v-if="list.itemCount > 1"
                title="Random pick"
                aria-label="Random pick"
                @click="randomOpenListId = list.id"
              >
                <mdicon name="dice-multiple-outline" :size="16" />
              </v-btn>
              <v-btn
                title="Share list"
                aria-label="Share list"
                @click="shareList(list.id)"
              >
                <mdicon name="share-variant" :size="16" />
              </v-btn>
              <v-btn
                title="Add to list"
                aria-label="Add to list"
                @click="startAdd(list.id)"
              >
                <mdicon name="plus" :size="16" />
              </v-btn>
            </div>
          </div>

          <div v-show="!isCollapsed(list.id)">
            <ListItems
              :club-slug="clubSlug"
              :list-id="list.id"
              :other-lists="otherLists(list.id)"
              :reviews-list-id="reviewsListId"
              :random-picker-open="randomOpenListId === list.id"
              :selected-item-id="
                selectedInfo?.listId === list.id ? selectedInfo.workId : null
              "
              :filter-text="searchTerm"
              @update:random-picker-open="
                (v) => {
                  if (!v) randomOpenListId = null;
                }
              "
              @select="(workId) => (selectedInfo = { listId: list.id, workId })"
              @deselect="selectedInfo = null"
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
