<template>
  <div class="flex-grow">
    <Teleport to="body">
      <v-modal v-if="showDeleteConfirmation" size="sm" @close="cancelDelete">
        <div class="flex flex-col gap-4">
          <h2 class="text-xl font-bold">Delete Review</h2>
          <p>Are you sure you want to delete this review? This action cannot be undone.</p>
          <div class="flex gap-3">
            <button
              class="flex-1 rounded-md bg-gray-600 py-3 font-bold text-white hover:brightness-110"
              @click="cancelDelete"
            >
              Cancel
            </button>
            <button
              class="flex-1 rounded-md bg-red-500 py-3 font-bold text-white hover:brightness-110"
              @click="confirmDelete"
            >
              Delete
            </button>
          </div>
        </div>
      </v-modal>
    </Teleport>
    <!-- Movie details -->
    <div :class="isDesktop ? 'flex flex-col items-center' : 'flex gap-4'">
      <img
        :src="`https://image.tmdb.org/t/p/w500/${movie.original.externalData?.poster_path}`"
        :class="isDesktop ? 'mb-8 w-1/2 rounded-lg' : 'w-1/3 rounded-lg'"
        alt="Movie poster"
      />
      <div class="flex w-full flex-col items-center">
        <h2 class="text-center text-xl font-bold">
          {{ movie.renderValue("title") }}
        </h2>
        <div class="mt-2 text-center text-sm text-gray-400">
          <FlexRender
            :render="reviewTable.getColumn('createdDate')?.columnDef.cell"
            :props="getCell(movie, 'createdDate')?.getContext()"
          />
        </div>
        <div
          class="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2"
        >
          <div v-if="movie.original.externalData?.release_date">
            <span class="text-gray-400">Release Date: </span>
            <span>{{
              formatDate(movie.original.externalData.release_date)
            }}</span>
          </div>
          <div v-if="movie.original.externalData?.runtime">
            <span class="text-gray-400">Runtime: </span>
            <span>{{ movie.original.externalData.runtime }} minutes</span>
          </div>
          <div v-if="movie.original.externalData?.genres?.length">
            <span class="text-gray-400">Genres: </span>
            <span>{{ movie.original.externalData.genres.join(", ") }}</span>
          </div>
          <div v-if="movie.original.externalData?.vote_average">
            <span class="text-gray-400">TMDB Rating: </span>
            <span>{{ movie.original.externalData.vote_average }}/10</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Ratings and other information -->
    <div class="mt-6 grid grid-cols-2 gap-4">
      <div
        v-for="cell in getVisibleCells(movie)"
        :key="cell.id"
        class="flex cursor-pointer items-center rounded-xl bg-lowBackground p-2"
        @click="
          shouldBlurScore(movie.id, cell.column.id) &&
          toggleMovieReveal(movie.id)
        "
      >
        <FlexRender
          :render="cell.column.columnDef.header"
          :props="cell.getContext()"
        />
        <div class="ml-2 flex-grow">
          <FlexRender
            :render="cell.column.columnDef.cell"
            :props="cell.getContext()"
            :class="{
              'blur filter': shouldBlurScore(movie.id, cell.column.id),
            }"
          />
        </div>
      </div>
    </div>

    <!-- Movie details if available -->
    <div v-if="movie.original.externalData" class="mt-6">
      <MovieDescription
        v-if="movie.original.externalData.overview"
        :key="movie.id"
        :overview="movie.original.externalData.overview"
      />
    </div>

    <!-- Action buttons -->
    <div class="mt-6 flex w-full gap-3">
      <button
        class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/20 py-3 text-red-500"
        @click="showDeleteConfirmation = true"
      >
        <mdicon name="delete" />
        <span>Delete</span>
      </button>
      <button
        class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/20 py-3 text-primary"
        @click="shareReview(movie.original.id)"
      >
        <mdicon name="share" />
        <span>Share</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { ref } from "vue";
import { useToast } from "vue-toastification";

import MovieDescription from "./MovieDescription.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

const props = defineProps<{
  movie: Row<DetailedReviewListItem>;
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
  blurScoresEnabled: boolean;
  isDesktop: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "toggle-reveal", movieId: string): void;
}>();

const showDeleteConfirmation = ref(false);
const cancelDelete = () => {
  showDeleteConfirmation.value = false;
};
const confirmDelete = () => {
  props.deleteReview(props.movie.original.id);
  showDeleteConfirmation.value = false;
  close();
};

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];

const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    // First filter out custom rendered columns
    if (CUSTOM_RENDERED_COLUMNS.includes(cell.column.id)) {
      return false;
    }

    // Always show current user's column with "+" sign to enter score
    if (
      isDefined(props.currentUserId) &&
      cell.column.id === `member_${props.currentUserId}`
    ) {
      return true;
    }

    // Then check if the cell has a value
    const value = cell.getValue();
    return value !== undefined && value !== null && value !== "";
  });
};

const getCell = (row: Row<DetailedReviewListItem>, columnId: string) => {
  return row.getVisibleCells().find((cell) => cell.column.id === columnId);
};

const close = () => {
  emit("close");
};

const formatDate = (dateString: string) => {
  return DateTime.fromISO(dateString).toLocaleString(DateTime.DATE_MED);
};

// Helper functions for the three-dot menu
const toast = useToast();

const shareReview = (id: string) => {
  // Extract clubId from the current URL path
  const pathParts = window.location.pathname.split("/");
  const clubIdIndex = pathParts.indexOf("club") + 1;
  const clubId = pathParts[clubIdIndex];

  const url = `${window.location.origin}/share/club/${clubId}/review/${id}`;
  navigator.clipboard.writeText(url).catch(console.error);
  toast.success("Share URL copied to clipboard!");
};

const toggleMovieReveal = (movieId: string) => {
  emit("toggle-reveal", movieId);
};

const shouldBlurScore = (rowId: string, columnId: string) => {
  // If blur scores setting is disabled in club settings, don't blur anything
  if (!props.blurScoresEnabled) {
    return false;
  }

  if (props.hasRated(rowId) || props.revealedMovieIds.has(rowId)) {
    return false;
  }

  if (columnId === `member_${props.currentUserId}`) {
    return false;
  }

  return columnId.startsWith("member_") || columnId === "score_average";
};
</script>
