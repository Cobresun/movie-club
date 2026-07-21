<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" transparent-handle @close="close">
      <template #default="{ closing }">
        <WorkDetailsContent
          :key="movie.id"
          :movie="movie"
          :review-table="reviewTable"
          :delete-review="deleteReview"
          :revealed-movie-ids="revealedMovieIds"
          :has-rated="hasRated"
          :current-user-id="currentUserId"
          :is-desktop="isDesktop"
          :dismissing="closing"
          @close="close"
          @toggle-reveal="toggleMovieReveal"
        />
      </template>
    </v-bottom-sheet>

    <!-- Desktop Drawer (side panel) -->
    <VSideDrawer v-if="isDesktop" @close="close">
      <template #default="{ closing }">
        <WorkDetailsContent
          :key="movie.id"
          :movie="movie"
          :review-table="reviewTable"
          :delete-review="deleteReview"
          :revealed-movie-ids="revealedMovieIds"
          :has-rated="hasRated"
          :current-user-id="currentUserId"
          :is-desktop="isDesktop"
          :dismissing="closing"
          @close="close"
          @toggle-reveal="toggleMovieReveal"
        />
      </template>
    </VSideDrawer>
  </div>
</template>

<script setup lang="ts">
import { Row, Table } from "@tanstack/vue-table";

import { DetailedReviewListItem } from "../../../../lib/types/lists";
import VBottomSheet from "../../../common/components/VBottomSheet.vue";
import WorkDetailsContent from "./WorkDetailsContent.vue";
import VSideDrawer from "@/common/components/VSideDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{
  movie: Row<DetailedReviewListItem>;
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
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
