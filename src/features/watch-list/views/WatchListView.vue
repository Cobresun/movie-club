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
        <div class="flex justify-center items-center" :class="'mb-0'">
          <div class="relative">
            <mdicon
              name="magnify"
              class="absolute top-1/2 left-8 transform -translate-y-1/2 text-slate-200"
            />
            <input
              ref="searchInput"
              v-model="searchTerm"
              class="p-2 pl-12 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-11/12 bg-background"
              placeholder="Search"
              @focusin="searchInputFocusIn"
              @focusout="searchInputFocusOut"
            />
            <div
              ref="searchInputSlash"
              class="border-2 rounded-md absolute top-1/2 right-8 px-2 py-1 transform -translate-y-1/2 border-slate-600"
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

import ClubBacklog from "../components/ClubBacklog.vue";
import WatchList from "../components/WatchList.vue";

import { WorkListType } from "@/common/types/generated/db";
import { useClubId } from "@/service/useClub";
import { useList } from "@/service/useList";

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const clubId = useClubId();
const { isLoading } = useList(clubId, WorkListType.watchlist);

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
  if (e.key == "/") {
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
