<template>
  <div>
    <!-- Movie Details Modal/Drawer -->
    <div
      v-if="movie"
      ref="drawerRef"
      class="fixed inset-x-0 z-50 transform md:fixed md:inset-y-0 md:left-auto md:right-0 md:w-[35vw] md:max-w-full"
      :class="{
        'inset-x-0 bottom-0': !isMediumScreen,
        'md:translate-x-full': !isOpen,
        'md:translate-x-0': isOpen,
        'transition-transform duration-300 ease-in-out': !isDragging,
      }"
      :style="{
        transform: !isMediumScreen
          ? `translateY(${!isOpen ? '100%' : Math.max(0, dragOffset) + 'px'})`
          : undefined,
      }"
      @click.stop
    >
      <!-- Drawer handle area (mobile only) - Fixed at top -->
      <div
        v-if="!isMediumScreen"
        class="relative flex h-8 w-full cursor-pointer items-center justify-center rounded-t-2xl bg-background"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <div class="h-1.5 w-12 rounded-full bg-gray-400"></div>
      </div>

      <div
        class="relative max-h-[85vh] overflow-y-auto border-white bg-background px-4 md:h-full md:max-h-full md:max-w-full md:border-l md:border-gray-700 md:shadow-xl"
        :class="{
          'rounded-t-2xl': isMediumScreen,
          'pt-8': isMediumScreen,
        }"
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
      >
        <!-- Close button (desktop only) -->
        <button
          v-if="isMediumScreen"
          class="absolute right-4 top-4 z-10"
          @click="close"
        >
          <mdicon name="close" />
        </button>

        <div class="flex-grow">
          <!-- Movie details -->
          <div
            :class="
              isMediumScreen ? 'flex flex-col items-center' : 'flex gap-4'
            "
          >
            <img
              :src="`https://image.tmdb.org/t/p/w500/${movie.original.externalData?.poster_path}`"
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
import { ref, onMounted, onUnmounted, watch } from "vue";
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

// Reset drag offset when drawer state changes
watch(
  () => props.isOpen,
  (newValue) => {
    if (!newValue) {
      // Reset drag offset when drawer closes
      dragOffset.value = 0;
      isDragging.value = false;
    }
  },
);

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

// Touch handling for drag-to-close
const touchStartY = ref<number | null>(null);
const touchStartTime = ref<number | null>(null);
const dragOffset = ref(0);
const isDragging = ref(false);

const handleTouchStart = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.touches.length === 1) {
    touchStartY.value = event.touches[0].clientY;
    touchStartTime.value = Date.now();
    isDragging.value = true;
    dragOffset.value = 0;
  }
};

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (touchStartY.value !== null && event.touches.length === 1) {
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - touchStartY.value;

    // Only allow downward dragging (positive deltaY)
    if (deltaY > 0) {
      // Add some resistance - drawer moves slower than finger
      dragOffset.value = deltaY * 0.8;
    } else {
      dragOffset.value = 0;
    }
  }
};

const handleTouchEnd = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  if (
    touchStartY.value !== null &&
    touchStartTime.value !== null &&
    event.changedTouches.length === 1
  ) {
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndTime = Date.now();

    const deltaY = touchEndY - touchStartY.value;
    const deltaTime = touchEndTime - touchStartTime.value;
    const velocity = deltaY / deltaTime; // pixels per ms

    // Determine if we should close or snap back
    const shouldClose =
      deltaY > 100 || // Dragged down more than 100px
      (deltaY > 50 && velocity > 0.3); // Dragged down 50px+ with sufficient velocity

    if (shouldClose) {
      close();
    } else {
      // Snap back to original position
      dragOffset.value = 0;
    }
  }

  // Reset touch tracking
  isDragging.value = false;
  touchStartY.value = null;
  touchStartTime.value = null;
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
