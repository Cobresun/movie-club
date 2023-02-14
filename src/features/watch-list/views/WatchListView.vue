<template>
  <div class="p-2">
    <div>
      <page-header
        :has-back="true"
        back-route="ClubHome"
        page-name="Watch List"
      />

      <loading-spinner v-if="loading" />

      <div v-if="!loading">
        <div class="flex justify-center items-center mb-4">
          <input
            v-model="searchTerm"
            class="p-2 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-11/12 bg-background"
            placeholder="Search"
          />
        </div>
        <WatchList :search-term="searchTerm" @start-animation="clearSearch" />
        <ClubBacklog :search-term="searchTerm" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";

import ClubBacklog from "../components/ClubBacklog.vue";
import WatchList from "../components/WatchList.vue";

import { useWatchList } from "@/service/useWatchList";

const route = useRoute();

const searchTerm = ref<string>("");

const { loading } = useWatchList(route.params.clubId as string);

const clearSearch = () => {
  searchTerm.value = "";
};
</script>
