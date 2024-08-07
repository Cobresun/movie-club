<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews">
      <div class="flex gap-2">
        <mdicon name="table" />
        <VToggle v-model="isGalleryView" />
        <mdicon name="image-multiple" />
      </div>
    </page-header>
    <loading-spinner v-if="loading" />
    <div v-else>
      <div
        class="flex items-center justify-center"
        :class="isGalleryView ? 'mb-4' : 'mb-0'"
      >
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
            <p name="slash" class="text-xs text-slate-200">/</p>
          </div>
        </div>
        <v-btn
          class="ml-2 flex h-11 w-11 items-center justify-center whitespace-nowrap"
          @click="openPrompt()"
        >
          <mdicon name="plus" />
        </v-btn>
      </div>
      <table-view
        v-if="!isGalleryView"
        :reviews="filteredReviews"
        :members="members ?? []"
        :open-prompt="openPrompt"
      />
      <gallery-view
        v-else
        :reviews="filteredReviews"
        :members="members ?? []"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";

import { filterMovies } from "../../../common/searchMovies";
import GalleryView from "../components/GalleryView.vue";
import TableView from "../components/TableView.vue";

import VToggle from "@/common/components/VToggle.vue";
import { WorkListType } from "@/common/types/generated/db";
import { DetailedReviewListItem } from "@/common/types/lists";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useMembers } from "@/service/useClub";
import { useList } from "@/service/useList";

const { clubId } = defineProps<{ clubId: string }>();

const isGalleryView = ref(false);

const { isLoading: loadingReviews, data: reviews } = useList(
  clubId,
  WorkListType.reviews,
);
const { isLoading: loadingMembers, data: members } = useMembers(clubId);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const searchTerm = ref("");
const filteredReviews = computed<DetailedReviewListItem[]>(() => {
  return filterMovies(reviews.value ?? [], searchTerm.value);
});

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key == "/") {
    if (searchInput.value === document.activeElement) {
      return;
    }
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

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};
</script>
