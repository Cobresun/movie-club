<template>
  <div class="relative flex-grow text-left">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      title="Delete Review"
      message="Are you sure you want to delete this review? This action cannot be undone."
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <button
      type="button"
      aria-label="Share review"
      class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
      @click="shareReview(movie.original.id)"
    >
      <mdicon name="share" size="18" />
    </button>

    <!-- One layout for both breakpoints: the desktop side drawer is roughly
         phone-width, so only the hero scale and the score-entry footer differ. -->
    <WorkPosterHero
      :poster-url="posterUrl"
      :backdrop-path="movieData?.backdrop_path"
      :title="movieTitle"
      :year="displayYear"
      :is-desktop="isDesktop"
    >
      <template v-if="hasValue(metaLine)" #meta>{{ metaLine }}</template>
      <template #date>
        <template v-if="!isEditingDate">
          <span
            class="inline-flex cursor-pointer items-center gap-1 hover:text-primary hover:underline"
            @click="openDateEditor"
          >
            Reviewed {{ formatDate(movie.original.createdDate) }}
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

    <!-- Club scores: the drawer's centerpiece, so it leads -->
    <section class="mt-5">
      <SectionHeader title="Club scores" />

      <div
        :inert="!showRevealPill"
        :aria-hidden="!showRevealPill || undefined"
        class="overflow-hidden transition-all duration-slow ease-standard"
        :style="{
          maxHeight: showRevealPill ? '4rem' : '0px',
          marginBottom: showRevealPill ? '0.75rem' : '0px',
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

      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="cell in getVisibleCells(movie)"
          :key="cell.id"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
          :class="[
            isAverageCell(cell)
              ? 'col-span-2 bg-primary/10 ring-1 ring-primary/25'
              : 'bg-lowBackground',
            { 'score-just-saved': isJustSavedCell(cell) },
          ]"
        >
          <div class="min-w-0 flex-1">
            <FlexRender
              :render="cell.column.columnDef.header"
              :props="headerCellProps(cell)"
            />
          </div>
          <div
            class="shrink-0 text-base font-semibold transition-[filter] duration-500 ease-standard"
            :class="
              shouldBlurScore(movie.id, cell.column.id) ? 'blur' : 'blur-none'
            "
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="scoreCellProps(cell)"
            />
          </div>
        </div>
      </div>
      <p
        v-if="getVisibleCells(movie).length === 0"
        class="text-sm text-gray-500"
      >
        No scores yet — be the first to rate it.
      </p>
    </section>

    <!-- Synopsis -->
    <section v-if="hasValue(overview)" class="mt-6">
      <SectionHeader title="Synopsis" />
      <WorkDescription :key="movie.id" :overview="overview" />
    </section>

    <CastList v-if="movieData" :actors="movieData.actors" class="mt-6" />

    <!-- Details: factual metadata, external ratings and links -->
    <section v-if="hasDetails" class="mt-6">
      <SectionHeader title="Details" />
      <div class="grid grid-cols-2 gap-x-4 gap-y-3">
        <MovieMetadataGrid
          v-if="movieData"
          :release-date="movieData.release_date"
          :directors="movieData.directors"
        />
        <BookMetadataGrid
          v-else-if="bookData"
          :first-publish-year="bookData.firstPublishYear"
          :subjects="bookData.subjects"
        />
        <div
          v-if="isDefined(tmdbScore)"
          :class="{ 'cursor-pointer hover:opacity-80': shouldBlurTmdbScore }"
          @click="revealTmdb"
        >
          <span
            class="block text-xs font-medium uppercase tracking-wide text-gray-500"
            >TMDB rating</span
          >
          <span class="inline-flex items-center gap-1.5 text-sm text-gray-200">
            <span
              class="transition-[filter] duration-500 ease-standard"
              :class="
                shouldBlurTmdbScore
                  ? 'select-none blur'
                  : 'select-auto blur-none'
              "
              >{{ tmdbScore }}<span class="text-gray-500">/10</span></span
            >
            <mdicon
              v-if="shouldBlurTmdbScore"
              name="eye-outline"
              size="14"
              class="text-gray-400"
            />
          </span>
        </div>
      </div>

      <div v-if="movieData" class="mt-4 flex flex-wrap gap-2">
        <ExternalLink label="Letterboxd" :href="letterboxdUrl" />
        <ExternalLink label="IMDb" :href="imdbUrl" />
        <ExternalLink label="Rotten Tomatoes" :href="rottenTomatoesUrl" />
      </div>

      <WatchProviders
        v-if="movieData"
        :external-id="movie.original.externalId"
        class="mt-4"
      />
    </section>

    <CommentThread :work-id="movie.original.id" :club-slug="clubId" />

    <DiscussionQuestions
      v-if="discussionQuestionsEnabled"
      :club-slug="clubId"
      :work-id="movie.original.id"
      :media-noun="mediaNoun"
    />

    <!-- Delete is deliberately tucked at the end of the content: it's a rare,
         destructive action and doesn't warrant sticky-footer prominence. -->
    <button
      type="button"
      class="mx-auto mt-8 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-red-400/80 transition hover:bg-red-500/10 hover:text-red-400"
      @click="showDeleteConfirmation = true"
    >
      <mdicon name="delete" size="16" />
      <span>Delete review</span>
    </button>

    <!-- Sticky score footer: the drawer's primary action, always one tap away.
         On desktop the entry panel grows out of this footer (ScoreEntryDock);
         on mobile the CTA opens score entry in its own overlay. -->
    <div
      v-if="isDefined(currentUserId)"
      class="sticky bottom-0 -mx-4 mt-4 border-t border-gray-700/60 bg-background px-4 pb-2 pt-3"
    >
      <ScoreEntryDock
        v-if="isDesktop"
        :target="movie.original"
        :score="myReview?.score"
        :review-id="myReview?.id"
        @saved="onScoreSaved"
      />
      <button
        v-else
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold tracking-wide text-text transition hover:brightness-110 active:scale-[0.98]"
        @click="showScoreEntry = true"
      >
        <mdicon :name="isDefined(myReview) ? 'pencil' : 'star'" size="20" />
        <span>{{
          isDefined(myReview) ? "Edit score" : `Rate this ${mediaNoun}`
        }}</span>
      </button>
    </div>

    <ScoreEntryModal
      v-if="showScoreEntry"
      :key="movie.original.id"
      :target="movie.original"
      :score="myReview?.score"
      :review-id="myReview?.id"
      @close="showScoreEntry = false"
      @saved="onScoreSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { Cell, FlexRender, Row, Table } from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";

import DiscussionQuestions from "./DiscussionQuestions.vue";
import ScoreEntryDock from "./ScoreEntryDock.vue";
import ScoreEntryModal from "./ScoreEntryModal.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

import { clubTypeConfig } from "@/common/clubType";
import BookMetadataGrid from "@/common/components/BookMetadataGrid.vue";
import CastList from "@/common/components/CastList.vue";
import CommentThread from "@/common/components/CommentThread.vue";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import ExternalLink from "@/common/components/ExternalLink.vue";
import MovieMetadataGrid from "@/common/components/MovieMetadataGrid.vue";
import SectionHeader from "@/common/components/SectionHeader.vue";
import WatchProviders from "@/common/components/WatchProviders.vue";
import WorkDescription from "@/common/components/WorkDescription.vue";
import WorkPosterHero from "@/common/components/WorkPosterHero.vue";
import { useShare } from "@/common/composables/useShare";
import {
  asBook,
  asMovie,
  workMetaLine,
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
// "couldn't recognize this ___" message).
const mediaNoun = computed(
  () => clubTypeConfig(club.value?.type ?? ClubType.movie).noun,
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

// "2h 35m · Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages"
// (books), shown in the hero under the title. Runtime and genres live here, so
// the Details section below only carries what the hero doesn't.
const metaLine = computed(() =>
  workMetaLine(props.movie.original.externalData),
);

const overview = computed(
  () => movieData.value?.overview ?? bookData.value?.description,
);

// TMDB publishes ratings with three decimals (7.783); one is plenty here.
const tmdbScore = computed(() =>
  movieData.value?.vote_average === undefined
    ? undefined
    : Math.round(movieData.value.vote_average * 10) / 10,
);

// Movies always have external links (Rotten Tomatoes is a title search);
// books only warrant the section when they have any facts to show.
const hasDetails = computed(() => {
  if (isDefined(movieData.value)) return true;
  const book = bookData.value;
  return (
    isDefined(book) &&
    (book.firstPublishYear !== undefined || book.subjects.length > 0)
  );
});

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

    // Then check if the cell has a value. The current user's own pill is no
    // exception: it only appears once they have scored (entry happens through
    // the sticky CTA, not the grid).
    const value = cell.getValue();
    return value !== undefined && value !== null && value !== "";
  });
};

// The average gets a full-width, primary-tinted tile so the club's verdict
// stands out from the individual member scores.
const isAverageCell = (cell: Cell<DetailedReviewListItem, unknown>) =>
  cell.column.id === "score_average";

// Tile headers show avatar + name (sm size) so members are identifiable
// without hovering; the same meta convention GalleryView uses.
const headerCellProps = (cell: Cell<DetailedReviewListItem, unknown>) => ({
  ...cell.getContext(),
  meta: {
    showName: true,
    size: "sm",
  },
});

// The drawer's member grid is display-only — the current user enters/edits
// their own score through the dedicated ScoreEntryPanel below it.
const scoreCellProps = (cell: Cell<DetailedReviewListItem, unknown>) => ({
  ...cell.getContext(),
  meta: {
    editable: false,
  },
});

// The current user's own review for this work, if any — prefills the panel and
// tells it whether to create (POST) or update (PUT).
const myReview = computed(() =>
  isDefined(props.currentUserId)
    ? props.movie.original.scores[props.currentUserId]
    : undefined,
);

// Mobile-only: score entry lives in its own overlay (ScoreEntryModal), opened
// from the sticky CTA. Desktop entry is inline via ScoreEntryDock instead.
const showScoreEntry = ref(false);

// Whimsical fanfare: once the current user persists a score (via the dial or
// the comparison flow), the drawer returns to the member grid and we pop their
// tile so the just-saved number is impossible to miss. Toggling the flag
// off→on across a tick restarts the CSS animation on repeat saves. The tile
// renders synchronously thanks to the optimistic mutation, so the class is
// present on its first paint. Reduced-motion neutralizes the pop globally
// (near-zero animation-duration in tailwind.css).
const SCORE_POP_MS = 700;
const justSaved = ref(false);
let justSavedTimer: ReturnType<typeof setTimeout> | undefined;

const onScoreSaved = () => {
  justSaved.value = false;
  void nextTick(() => {
    justSaved.value = true;
    if (isDefined(justSavedTimer)) clearTimeout(justSavedTimer);
    justSavedTimer = setTimeout(() => {
      justSaved.value = false;
    }, SCORE_POP_MS);
  });
};

onBeforeUnmount(() => {
  if (isDefined(justSavedTimer)) clearTimeout(justSavedTimer);
});

// Only the current user's own tile celebrates — identified by the `member_<id>`
// column id the reviews table builds per member.
const isJustSavedCell = (cell: Cell<DetailedReviewListItem, unknown>) =>
  justSaved.value &&
  isDefined(props.currentUserId) &&
  cell.column.id === `member_${props.currentUserId}`;

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
  if (
    props.hasRated(props.movie.id) ||
    props.revealedMovieIds.has(props.movie.id)
  )
    return false;
  return hasClubScoresToReveal.value;
});

const tmdbRevealed = ref(false);

const shouldBlurTmdbScore = computed(() => {
  if (props.hasRated(props.movie.id) || tmdbRevealed.value) return false;
  return true;
});

const revealTmdb = () => {
  if (shouldBlurTmdbScore.value) {
    tmdbRevealed.value = true;
  }
};
</script>

<style scoped>
/* Celebratory pop for the score the current user just saved: a springy
   overshoot with a playful wobble, haloed by a fading primary-blue ring.
   z-index lifts it above the neighbouring tiles while it scales up. */
@keyframes score-pop {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
  }
  25% {
    transform: scale(1.12) rotate(-2.5deg);
    box-shadow: 0 0 0 5px rgba(33, 150, 243, 0.35);
  }
  50% {
    transform: scale(0.97) rotate(2deg);
  }
  70% {
    transform: scale(1.05) rotate(-1deg);
    box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15);
  }
  100% {
    transform: scale(1) rotate(0);
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
  }
}

.score-just-saved {
  position: relative;
  z-index: 10;
  animation: score-pop 700ms var(--ease-emphasized);
}
</style>
