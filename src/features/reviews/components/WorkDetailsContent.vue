<template>
  <div class="flex-grow text-left">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Desktop layout -->
    <template v-if="isDesktop">
      <WorkPosterHero
        :poster-url="posterUrl"
        :backdrop-path="movieData?.backdrop_path"
        :title="movieTitle"
        :year="displayYear"
        :is-desktop="isDesktop"
      >
        <template #date>
          <template v-if="!isEditingDate">
            <span
              class="inline-flex cursor-pointer items-center gap-1 hover:text-primary hover:underline"
              @click="openDateEditor"
            >
              {{ formatDate(movie.original.createdDate) }}
              <mdicon name="pencil" size="14" class="text-current" />
            </span>
          </template>
          <template v-else>
            <div class="flex items-center justify-center gap-1.5 px-2">
              <input
                v-model="editedDate"
                type="date"
                class="rounded border border-gray-600 bg-background px-1.5 py-0.5 text-xs text-white sm:px-2 sm:py-1 sm:text-sm"
                @keypress.enter="saveDateChange"
              />
              <button
                class="whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-xs text-white sm:px-2 sm:py-1 sm:text-sm"
                @click="saveDateChange"
              >
                Save
              </button>
              <button
                class="whitespace-nowrap rounded bg-gray-600 px-1.5 py-0.5 text-xs text-white sm:px-2 sm:py-1 sm:text-sm"
                @click="cancelDateEdit"
              >
                Cancel
              </button>
            </div>
          </template>
        </template>
      </WorkPosterHero>

      <div class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2">
        <MovieMetadataGrid
          v-if="movieData"
          :release-date="movieData.release_date"
          :runtime="movieData.runtime"
          :genres="movieData.genres"
          :directors="movieData.directors"
        />
        <BookMetadataGrid
          v-else-if="bookData"
          :authors="bookData.authors"
          :first-publish-year="bookData.firstPublishYear"
          :number-of-pages="bookData.numberOfPages"
          :subjects="bookData.subjects"
        />
        <CastList
          v-if="movieData"
          :actors="movieData?.actors"
          class="md:col-span-2"
        />
        <div
          v-if="movieData?.vote_average"
          class="flex items-center gap-2"
          :class="{
            'cursor-pointer hover:opacity-80': shouldBlurTmdbScore,
          }"
          @click="revealTmdb"
        >
          <span class="text-gray-400">TMDB Rating: </span>
          <span
            class="transition-[filter] duration-500 ease-out"
            :class="
              shouldBlurTmdbScore ? 'select-none blur' : 'select-auto blur-none'
            "
            >{{ movieData?.vote_average }}/10</span
          >
          <mdicon
            v-if="shouldBlurTmdbScore"
            name="eye-outline"
            size="14"
            class="text-gray-400"
          />
        </div>
        <div
          v-if="movieData"
          class="flex flex-wrap items-center gap-x-4 gap-y-1 md:col-span-2"
        >
          <ExternalLink label="Letterboxd" :href="letterboxdUrl" />
          <ExternalLink label="IMDb" :href="imdbUrl" />
          <ExternalLink label="Rotten Tomatoes" :href="rottenTomatoesUrl" />
        </div>
        <WatchProviders
          v-if="movieData"
          :external-id="movie.original.externalId"
          class="md:col-span-2"
        />
      </div>

      <div
        :inert="!showRevealPill"
        :aria-hidden="!showRevealPill || undefined"
        class="overflow-hidden transition-all duration-300 ease-out"
        :style="{
          maxHeight: showRevealPill ? '4rem' : '0px',
          marginTop: showRevealPill ? '1.5rem' : '0px',
          opacity: showRevealPill ? 1 : 0,
        }"
      >
        <div class="flex justify-center">
          <button
            class="flex items-center gap-2 rounded-full bg-lowBackground px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
            @click="toggleMovieReveal(movie.id)"
          >
            <mdicon name="eye-outline" size="16" />
            <span>Reveal club scores</span>
          </button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-4">
        <div
          v-for="cell in getVisibleCells(movie)"
          :key="cell.id"
          class="flex items-center rounded-xl bg-lowBackground p-2"
        >
          <FlexRender
            :render="cell.column.columnDef.header"
            :props="cell.getContext()"
          />
          <div
            class="ml-2 flex-grow transition-[filter] duration-500 ease-out"
            :class="
              shouldBlurScore(movie.id, cell.column.id) ? 'blur' : 'blur-none'
            "
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </div>
        </div>
      </div>

      <div v-if="movieData?.overview || bookData?.description" class="mt-6">
        <WorkDescription
          :key="movie.id"
          :overview="movieData?.overview ?? bookData?.description ?? ''"
        />
      </div>

      <CommentThread :work-id="movie.original.id" :club-slug="clubId" />

      <DiscussionQuestions
        v-if="discussionQuestionsEnabled"
        :club-slug="clubId"
        :work-id="movie.original.id"
        :media-noun="mediaNoun"
      />

      <div
        class="sticky bottom-0 -mx-4 mt-6 border-t border-gray-700/60 bg-background px-4 pb-2 pt-3"
      >
        <div class="flex w-full gap-3">
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

    <!-- Mobile layout -->
    <template v-else>
      <WorkPosterHero
        :poster-url="posterUrl"
        :backdrop-path="movieData?.backdrop_path"
        :title="movieTitle"
        :year="displayYear"
        :is-desktop="isDesktop"
      >
        <template #date>
          <template v-if="!isEditingDate">
            <span
              class="inline-flex cursor-pointer items-center gap-1 hover:text-primary hover:underline"
              @click="openDateEditor"
            >
              {{ formatDate(movie.original.createdDate) }}
              <mdicon name="pencil" size="14" class="text-current" />
            </span>
          </template>
          <template v-else>
            <div class="flex items-center gap-1.5">
              <input
                v-model="editedDate"
                type="date"
                class="rounded border border-gray-600 bg-background px-1.5 py-0.5 text-xs text-white"
                @keypress.enter="saveDateChange"
              />
              <button
                class="whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-xs text-white"
                @click="saveDateChange"
              >
                Save
              </button>
              <button
                class="whitespace-nowrap rounded bg-gray-600 px-1.5 py-0.5 text-xs text-white"
                @click="cancelDateEdit"
              >
                Cancel
              </button>
            </div>
          </template>
        </template>
      </WorkPosterHero>

      <div
        :inert="!showRevealPill"
        :aria-hidden="!showRevealPill || undefined"
        class="overflow-hidden transition-all duration-300 ease-out"
        :style="{
          maxHeight: showRevealPill ? '4rem' : '0px',
          marginTop: showRevealPill ? '0.5rem' : '0px',
          opacity: showRevealPill ? 1 : 0,
        }"
      >
        <div class="flex justify-center">
          <button
            class="flex items-center gap-2 rounded-full bg-lowBackground px-4 py-1.5 text-sm text-gray-300 transition hover:brightness-110"
            @click="toggleMovieReveal(movie.id)"
          >
            <mdicon name="eye-outline" size="16" />
            <span>Reveal club scores</span>
          </button>
        </div>
      </div>

      <!-- Scores grid (prioritized on mobile) -->
      <div class="mt-3 grid grid-cols-2 gap-4">
        <div
          v-for="cell in getVisibleCells(movie)"
          :key="cell.id"
          class="flex items-center rounded-xl bg-lowBackground p-2"
        >
          <FlexRender
            :render="cell.column.columnDef.header"
            :props="cell.getContext()"
          />
          <div
            class="ml-2 flex-grow transition-[filter] duration-500 ease-out"
            :class="
              shouldBlurScore(movie.id, cell.column.id) ? 'blur' : 'blur-none'
            "
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </div>
        </div>
      </div>

      <CastList :actors="movieData?.actors" class="mt-4" />

      <!-- Collapsible metadata -->
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="mt-4 flex w-full items-center justify-between rounded-lg bg-lowBackground px-4 py-2.5 text-sm font-medium text-gray-300"
        >
          <span>Details</span>
          <mdicon
            name="chevron-down"
            :class="open ? 'rotate-180 transform' : ''"
            class="transition-transform duration-200"
          />
        </DisclosureButton>
        <DisclosurePanel class="mt-2 grid grid-cols-1 gap-y-2 px-1 text-sm">
          <MovieMetadataGrid
            v-if="movieData"
            :release-date="movieData.release_date"
            :runtime="movieData.runtime"
            :genres="movieData.genres"
            :directors="movieData.directors"
          />
          <BookMetadataGrid
            v-else-if="bookData"
            :authors="bookData.authors"
            :first-publish-year="bookData.firstPublishYear"
            :number-of-pages="bookData.numberOfPages"
            :subjects="bookData.subjects"
          />
          <div
            v-if="movieData?.vote_average"
            class="flex items-center gap-2"
            :class="{
              'cursor-pointer hover:opacity-80': shouldBlurTmdbScore,
            }"
            @click="revealTmdb"
          >
            <span class="text-gray-400">TMDB Rating: </span>
            <span :class="{ 'select-none blur filter': shouldBlurTmdbScore }"
              >{{ movieData?.vote_average }}/10</span
            >
            <mdicon
              v-if="shouldBlurTmdbScore"
              name="eye-outline"
              size="14"
              class="text-gray-400"
            />
          </div>
          <div
            v-if="movieData"
            class="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            <ExternalLink label="Letterboxd" :href="letterboxdUrl" />
            <ExternalLink label="IMDb" :href="imdbUrl" />
            <ExternalLink label="Rotten Tomatoes" :href="rottenTomatoesUrl" />
          </div>
          <WatchProviders
            v-if="movieData"
            :external-id="movie.original.externalId"
          />
          <WorkDescription
            v-if="movieData?.overview || bookData?.description"
            :key="movie.id"
            :overview="movieData?.overview ?? bookData?.description ?? ''"
            class="mt-2"
          />
        </DisclosurePanel>
      </Disclosure>

      <CommentThread :work-id="movie.original.id" :club-slug="clubId" />

      <DiscussionQuestions
        v-if="discussionQuestionsEnabled"
        :club-slug="clubId"
        :work-id="movie.original.id"
        :media-noun="mediaNoun"
      />

      <!-- Sticky action footer -->
      <div
        class="sticky bottom-0 -mx-4 mt-6 border-t border-gray-700/60 bg-background px-4 pb-2 pt-3"
      >
        <div class="flex w-full gap-3">
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
  </div>
</template>

<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import DiscussionQuestions from "./DiscussionQuestions.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

import BookMetadataGrid from "@/common/components/BookMetadataGrid.vue";
import CastList from "@/common/components/CastList.vue";
import CommentThread from "@/common/components/CommentThread.vue";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import ExternalLink from "@/common/components/ExternalLink.vue";
import MovieMetadataGrid from "@/common/components/MovieMetadataGrid.vue";
import WatchProviders from "@/common/components/WatchProviders.vue";
import WorkDescription from "@/common/components/WorkDescription.vue";
import WorkPosterHero from "@/common/components/WorkPosterHero.vue";
import { useShare } from "@/common/composables/useShare";
import {
  asBook,
  asMovie,
  workPosterUrl,
  workSubtitle,
} from "@/common/workDisplay";
import { useClub, useClubSettings, useClubSlug } from "@/service/useClub";
import { useReviewsListId, useUpdateAddedDate } from "@/service/useList";

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

// Date editing state
const clubId = useClubSlug();
const { data: club } = useClub(clubId);
const { data: clubSettings } = useClubSettings(clubId);
const { data: reviewsListId } = useReviewsListId(clubId);
const { mutate: updateAddedDate } = useUpdateAddedDate(clubId);
const isEditingDate = ref(false);
const editedDate = ref("");

const discussionQuestionsEnabled = computed(
  () => clubSettings.value?.features?.discussionQuestions === true,
);
const movieTitle = computed(() => String(props.movie.renderValue("title")));

const formattedDateForInput = computed(() => {
  return DateTime.fromISO(props.movie.original.createdDate).toFormat(
    "yyyy-MM-dd",
  );
});

const openDateEditor = () => {
  editedDate.value = formattedDateForInput.value;
  isEditingDate.value = true;
};

const saveDateChange = () => {
  if (hasValue(editedDate.value)) {
    const isoDate = DateTime.fromFormat(editedDate.value, "yyyy-MM-dd")
      .startOf("day")
      .toISO();

    if (isoDate !== null && hasValue(reviewsListId.value)) {
      updateAddedDate({
        listId: reviewsListId.value,
        workId: props.movie.original.id,
        addedDate: isoDate,
      });
    }
  }
  isEditingDate.value = false;
};

const cancelDateEdit = () => {
  isEditingDate.value = false;
};

const movieData = computed(() => asMovie(props.movie.original.externalData));
const bookData = computed(() => asBook(props.movie.original.externalData));
// Drives book/movie wording in child components (e.g. the discussion-questions
// "couldn't recognize this ___" message). Mirrors the movieData/bookData split.
const mediaNoun = computed<"movie" | "book">(() =>
  isDefined(bookData.value) ? "book" : "movie",
);
const posterUrl = computed(() =>
  workPosterUrl(
    props.movie.original.externalData,
    props.movie.original.imageUrl,
  ),
);

// Release year (movies) or first-published year (books), via the shared helper.
const displayYear = computed(() =>
  workSubtitle(props.movie.original.externalData),
);

const letterboxdUrl = computed(() =>
  hasValue(props.movie.original.externalId)
    ? `https://letterboxd.com/tmdb/${props.movie.original.externalId}/`
    : undefined,
);

const imdbUrl = computed(() => {
  const imdbId = asMovie(props.movie.original.externalData)?.imdb_id;
  return hasValue(imdbId) ? `https://www.imdb.com/title/${imdbId}/` : undefined;
});

const rottenTomatoesUrl = computed(() => {
  const title = props.movie.original.title;
  return hasValue(title)
    ? `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`
    : undefined;
});

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

const close = () => {
  emit("close");
};

const formatDate = (dateString: string) => {
  return DateTime.fromISO(dateString).toLocaleString(DateTime.DATE_MED);
};

// Share functionality
const { share } = useShare();

const shareReview = (id: string) => {
  const url = `${window.location.origin}/share/club/${clubId}/review/${id}`;
  const title = String(props.movie.renderValue("title"));
  const clubName = club.value?.clubName ?? "Movie Club";

  void share({
    url,
    title: `${title} - ${clubName} Review`,
    text: `${clubName}'s review of ${title}`,
  });
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

const hasClubScoresToReveal = computed(() => {
  return getVisibleCells(props.movie).some((cell) => {
    const colId = cell.column.id;
    if (colId === `member_${props.currentUserId}`) return false;
    return colId.startsWith("member_") || colId === "score_average";
  });
});

const showRevealPill = computed(() => {
  if (!props.blurScoresEnabled) return false;
  if (
    props.hasRated(props.movie.id) ||
    props.revealedMovieIds.has(props.movie.id)
  )
    return false;
  return hasClubScoresToReveal.value;
});

const tmdbRevealed = ref(false);

const shouldBlurTmdbScore = computed(() => {
  if (!props.blurScoresEnabled) return false;
  if (props.hasRated(props.movie.id) || tmdbRevealed.value) return false;
  return true;
});

const revealTmdb = () => {
  if (shouldBlurTmdbScore.value) {
    tmdbRevealed.value = true;
  }
};
</script>
