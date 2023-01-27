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
        class="flex justify-center items-center"
        :class="isGalleryView ? 'mb-4' : 'mb-0'"
      >
        <input
          v-model="searchTerm"
          class="p-2 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-11/12 bg-background"
          placeholder="Search"
        />
        <v-btn
          class="ml-2 h-11 w-11 whitespace-nowrap flex justify-center items-center"
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
        :submit-score="submitScore"
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
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

import GalleryView from "../components/GalleryView.vue";
import TableView from "../components/TableView.vue";
import { filterReviews } from "../searchReviews";

import VToggle from "@/common/components/VToggle.vue";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useMembers } from "@/service/useClub";
import { useDetailedReview, useSubmitScore } from "@/service/useReview";

const isGalleryView = ref(false);

const route = useRoute();

const { loading: loadingReviews, data: reviews } = useDetailedReview(
  route.params.clubId as string
);
const { loading: loadingMembers, data: members } = useMembers(
  route.params.clubId as string
);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const { submit } = useSubmitScore(route.params.clubId as string);

const submitScore = (movieId: number, score: number) => {
  if (!isNaN(score) && score >= 0 && score <= 10) {
    submit(movieId, score);
  }
};

const searchTerm = ref("");
const filteredReviews = computed(() => {
  return filterReviews(reviews.value ?? [], searchTerm.value);
});
</script>
