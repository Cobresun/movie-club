<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" transparent-handle @close="close">
      <MovieDetailsContent
        :key="movie.id"
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
    </v-bottom-sheet>

    <!-- Desktop Drawer (side panel) -->
    <VSideDrawer v-if="isDesktop" @close="close">
      <MovieDetailsContent
        :key="movie.id"
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
    </VSideDrawer>
  </div>
</template>

<script setup lang="ts">
import { Row, Table } from "@tanstack/vue-table";

import MovieDetailsContent from "./MovieDetailsContent.vue";
import { DetailedReviewListItem } from "../../../../lib/types/lists.js";
import VBottomSheet from "../../../common/components/VBottomSheet.vue";

import VSideDrawer from "@/common/components/VSideDrawer.vue";
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
