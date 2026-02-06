<template>
  <div class="p-2">
    <div>
      <page-header
        :has-back="true"
        back-route="ClubHome"
        page-name="Watch List"
      />

      <loading-spinner v-if="isLoading" />

      <div v-if="!isLoading">
        <div class="mb-2 flex items-center justify-center">
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
        </div>
        <WatchList :search-term="searchTerm" :clear-search="clearSearch" />
        <ClubBacklog :search-term="searchTerm" :clear-search="clearSearch" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { WorkListType } from "../../../../lib/types/generated/db";
import ClubBacklog from "../components/ClubBacklog.vue";
import WatchList from "../components/WatchList.vue";

import { useClubSlug } from "@/service/useClub";
import { useList } from "@/service/useList";

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const clubSlug = useClubSlug();
const { isLoading } = useList(clubSlug, WorkListType.watchlist);

const searchTerm = ref("");
const clearSearch = () => {
  searchTerm.value = "";
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key === "/") {
    if (searchInput.value === document.activeElement) {
      return;
    }
    e.preventDefault();
    searchInput.value?.focus();
  }
};

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};
</script>
