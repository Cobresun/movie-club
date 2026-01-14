<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" @close="close">
      <div class="flex-grow px-4 pb-8">
        <MovieDetailsContent
          :movie="movie"
          :review-table="reviewTable"
          :delete-review="deleteReview"
          :revealed-movie-ids="revealedMovieIds"
          :has-rated="hasRated"
          :current-user-id="currentUserId"
          :blur-scores-enabled="blurScoresEnabled"
          :is-desktop="isDesktop"
          @close="close"
          @toggle-reveal="toggleMovieReveal"
        />
      </div>
    </v-bottom-sheet>

    <!-- Desktop Drawer (side panel) -->
    <div
      v-if="isDesktop"
      class="fixed inset-y-0 right-0 z-50 w-[35vw] max-w-full transform bg-background md:border-l md:border-gray-700 md:shadow-xl"
      @click.stop
    >
      <div class="relative h-full overflow-y-auto px-4 pt-8">
        <!-- Close button (desktop only) -->
        <button class="absolute right-4 top-4 z-10" @click="close">
          <mdicon name="close" />
        </button>

        <MovieDetailsContent
          :movie="movie"
          :review-table="reviewTable"
          :delete-review="deleteReview"
          :revealed-movie-ids="revealedMovieIds"
          :has-rated="hasRated"
          :current-user-id="currentUserId"
          :blur-scores-enabled="blurScoresEnabled"
          :is-desktop="isDesktop"
          @close="close"
          @toggle-reveal="toggleMovieReveal"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Row, Table } from "@tanstack/vue-table";

import MovieDetailsContent from "./MovieDetailsContent.vue";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import VBottomSheet from "../../../common/components/VBottomSheet.vue";

import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{
  movie: Row<DetailedReviewListItem>;
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
  blurScoresEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: "update:isOpen", value: boolean): void;
  (e: "toggle-reveal", movieId: string): void;
  (e: "close"): void;
}>();

const isDesktop = useIsDesktop();

const close = () => {
  emit("close");
};

const toggleMovieReveal = (movieId: string) => {
  emit("toggle-reveal", movieId);
};
</script>
