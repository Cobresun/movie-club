<template>
  <div>
    <!-- Movie Details Modal/Drawer -->
    <div
      v-if="movie"
      ref="drawerRef"
      class="fixed inset-x-0 z-50 transform transition-transform duration-300 ease-in-out md:fixed md:inset-y-0 md:left-auto md:right-0 md:w-[35vw] md:max-w-full"
      :class="{
        'inset-x-0 bottom-0 translate-y-0': isOpen && !isMediumScreen,
        'inset-x-0 bottom-0 translate-y-full': !isOpen && !isMediumScreen,
        'md:translate-x-full': !isOpen,
        'md:translate-x-0': isOpen,
      }"
      @click.stop
    >
      <div
        class="relative max-h-[85vh] overflow-y-auto border-white bg-background p-4 md:h-full md:max-h-full md:max-w-full md:border-l md:border-gray-700 md:shadow-xl"
        :class="{ 'rounded-t-2xl': !isMediumScreen }"
      >
        <!-- Drawer handle (mobile only) -->
        <div
          v-if="!isMediumScreen"
          class="absolute -top-3 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-gray-400"
        ></div>

        <!-- Close button (desktop only) -->
        <button
          v-if="isMediumScreen"
          class="absolute right-4 top-4 z-10"
          @click="close"
        >
          <mdicon name="close" />
        </button>

        <div class="mt-4 flex-grow pt-2">
          <!-- Movie details -->
          <div
            :class="
              isMediumScreen ? 'flex flex-col items-center' : 'flex gap-4'
            "
          >
            <img
              :src="movie.renderValue('imageUrl')"
              :class="
                isMediumScreen ? 'mb-8 w-1/2 rounded-lg' : 'w-1/3 rounded-lg'
              "
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
                  <span>{{
                    movie.original.externalData.genres.join(", ")
                  }}</span>
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
            <p
              v-if="movie.original.externalData.overview"
              class="mb-4 text-sm text-gray-300"
            >
              {{ movie.original.externalData.overview }}
            </p>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="mt-6 mt-auto flex w-full gap-3">
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/20 py-3 text-red-500"
            @click="
              deleteReview(movie.original.id);
              close();
            "
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
    </div>

    <!-- Keep the backdrop overlay for mobile only -->
    <div
      v-if="isOpen && !isMediumScreen"
      class="fixed inset-0 z-30 bg-black bg-opacity-50"
      @click="close"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { ref, onMounted, onUnmounted } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

const props = defineProps<{
  movie: Row<DetailedReviewListItem> | null;
  isOpen: boolean;
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
}>();

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

// Media query for medium screens
const isMediumScreen = ref(false);

const checkScreenSize = () => {
  isMediumScreen.value = window.matchMedia("(min-width: 768px)").matches;
};

onMounted(() => {
  checkScreenSize();
  window.addEventListener("resize", checkScreenSize);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkScreenSize);
});

const close = () => {
  emit("update:isOpen", false);
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
  void navigator.clipboard.writeText(url);
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

<style scoped>
.translate-y-full {
  transform: translateY(100%);
}

.blur-container {
  filter: blur(5px);
}

@media (min-width: 768px) {
  .md\:translate-x-full {
    transform: translateX(100%);
  }

  .md\:translate-x-0 {
    transform: translateX(0);
  }

  .md\:opacity-0 {
    opacity: 0;
    pointer-events: none;
  }

  .md\:opacity-100 {
    opacity: 1;
    pointer-events: auto;
    transition: opacity 300ms ease-in-out;
  }
}
</style>
