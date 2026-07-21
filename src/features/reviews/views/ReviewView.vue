<template>
  <div class="p-2 text-center">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <score-assist-modal
      v-if="isDefined(scoreAssistTarget)"
      :key="scoreAssistTarget.id"
      :target="scoreAssistTarget"
      :candidates="scoreAssistCandidates"
      :club-type="club?.type ?? ClubType.movie"
      @close="scoreAssistWorkId = undefined"
    />
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews" />
    <loading-spinner v-if="loading" />
    <div v-else>
      <!-- Search Filter Bar -->
      <search-filter-bar
        v-model:filtered-data="filteredReviews"
        v-model:has-active-filters="hasActiveFilters"
        :data="reviews ?? []"
        :club-type="club?.type ?? ClubType.movie"
        search-placeholder="Search reviews"
        class-name="mb-4"
      >
        <template #action-button>
          <v-btn
            aria-label="Add review"
            title="Add review"
            class="flex h-11 w-11 items-center justify-center whitespace-nowrap"
            @click="openPrompt()"
          >
            <mdicon name="plus" />
          </v-btn>
        </template>
      </search-filter-bar>

      <div v-if="showEmptyState">
        <EmptyState
          :title="hasSearchTerm ? 'No Results Found' : 'No Reviews Yet'"
          :description="hasSearchTerm ? searchEmptyDescription : noReviewsDescription"
          :action-label="hasSearchTerm ? undefined : 'Add Review'"
          :action-icon="hasSearchTerm ? undefined : 'plus'"
          @action="openPrompt"
        />
      </div>
      <gallery-view
        v-else
        :review-table="reviewTable"
        :delete-review="deleteReview"
        :members="members"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasUserRated"
        :current-user-id="userId"
        @toggle-reveal="toggleReveal"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { computed, ref, h, provide } from "vue";

import { hasValue, isDefined, isTrue } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import GalleryView from "../components/GalleryView.vue";
import MovieTooltip from "../components/MovieTooltip.vue";
import ReviewScore from "../components/ReviewScore.vue";
import ScoreAssistModal from "../components/ScoreAssistModal.vue";
import { buildCandidatePool, isScoreAssistEligible } from "../composables/scoreAssistLogic";
import { ScoreAssistKey } from "../scoreAssist";
import AverageImg from "@/assets/images/average.svg";
import { clubTypeConfig } from "@/common/clubType";
import EmptyState from "@/common/components/EmptyState.vue";
import SearchFilterBar from "@/common/components/SearchFilterBar.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import { asMovie } from "@/common/workDisplay";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useClub, useMembers } from "@/service/useClub";
import { useDeleteReview, useReviewsList, useReviewsListId } from "@/service/useList";
import { useUser } from "@/service/useUser";

const { clubSlug } = defineProps<{ clubSlug: string }>();

// Load club data for share functionality
const { data: club } = useClub(clubSlug);

const { isLoading: loadingReviews, data: reviews } = useReviewsList(clubSlug);
const { isLoading: loadingMembers, data: membersResponse } = useMembers(clubSlug);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

// Filtered reviews from SearchFilterBar
const filteredReviews = ref<DetailedReviewListItem[]>([]);
const hasActiveFilters = ref(false);

const hasSearchTerm = computed(() => hasActiveFilters.value);
const showEmptyState = computed(() => !loading.value && filteredReviews.value.length === 0);

const searchEmptyDescription = computed(() => {
  const fields = clubTypeConfig(club.value?.type ?? ClubType.movie).searchableFieldsHint;
  return `Try adjusting your search or filters. You can search by ${fields}`;
});
const noReviewsDescription = computed(() => {
  const noun = clubTypeConfig(club.value?.type ?? ClubType.movie).noun;
  return `Start building your club's ${noun} collection by adding your first review`;
});

const columnHelper = createColumnHelper<DetailedReviewListItem>();

const members = computed(() => membersResponse.value ?? []);

const { data: reviewsListId } = useReviewsListId(clubSlug);
const { mutate: deleteReviewMutation } = useDeleteReview(clubSlug);
const deleteReview = (workId: string) => {
  if (!hasValue(reviewsListId.value)) return;
  deleteReviewMutation({ workId, reviewsListId: reviewsListId.value });
};

const currentUser = useUser();
const userId = computed(() => currentUser.value?.id);

// Score Assist: one modal instance lives here; scattered score-entry
// affordances open it (and gate their trigger) through the provided key.
const scoreAssistWorkId = ref<string>();
const scoreAssistTarget = computed(() =>
  reviews.value?.find((review) => review.id === scoreAssistWorkId.value),
);
const scoreAssistCandidates = computed(() => {
  const target = scoreAssistTarget.value;
  if (!isDefined(target) || !hasValue(userId.value)) return [];
  return buildCandidatePool(reviews.value ?? [], userId.value, target.id);
});
provide(ScoreAssistKey, {
  isEligible: (workId: string) => isScoreAssistEligible(reviews.value, userId.value, workId),
  open: (workId: string) => {
    scoreAssistWorkId.value = workId;
  },
});

const revealedMovieIds = ref<Set<string>>(new Set());
const hasUserRated = computed(() => {
  if (userId.value === undefined) return () => false;

  return (movieId: string) => {
    const review = filteredReviews.value?.find((review) => review.id === movieId);
    return Boolean(review?.scores[userId.value ?? ""]?.score !== undefined);
  };
});

const toggleReveal = (movieId: string) => {
  if (revealedMovieIds.value.has(movieId)) {
    revealedMovieIds.value.delete(movieId);
  } else {
    revealedMovieIds.value.add(movieId);
  }
  revealedMovieIds.value = new Set(revealedMovieIds.value);
};

const shouldBlurScore = (rowId: string, columnId: string) => {
  if (hasUserRated.value(rowId) || revealedMovieIds.value.has(rowId)) {
    return false;
  }

  if (columnId === `member_${userId.value}`) {
    return false;
  }

  return columnId.startsWith("member_") || columnId === "score_average";
};

const columns = computed(() => [
  columnHelper.accessor("imageUrl", {
    header: "Poster",
  }),
  columnHelper.accessor("title", {
    header: "Title",
    cell: (info) =>
      h(MovieTooltip, {
        title: info.getValue(),
        imageUrl: info.row.original.imageUrl,
        movie: asMovie(info.row.original.externalData),
      }),
    meta: {
      class: "font-bold align-middle",
    },
  }),
  columnHelper.accessor("createdDate", {
    header: "Date Reviewed",
    cell: (info) => DateTime.fromISO(info.getValue()).toLocaleString(),
  }),
  ...members.value.map((member) =>
    columnHelper.accessor((row) => row.scores[member.id]?.score, {
      id: `member_${member.id}`,
      header: (context) => {
        let size: number | undefined;
        if (typeof context.meta?.size === "string") {
          size = context.meta.size === "sm" ? 28 : undefined;
        }

        if (isTrue(context.meta?.showName)) {
          return h("div", { class: "flex min-w-0 items-center gap-2" }, [
            h(VAvatar, {
              src: member.image,
              name: member.name,
              size,
            }),
            h("span", { class: "truncate" }, member.name),
          ]);
        } else {
          return h(VAvatar, {
            src: member.image,
            name: member.name,
            size,
          });
        }
      },
      cell: (info) => {
        const value = info.getValue();
        const score = value === undefined ? undefined : Math.round(value * 100) / 100;
        let size: string | undefined;
        if (typeof info.meta?.size === "string") {
          size = info.meta.size;
        }

        // Read-only in the gallery cards and the details drawer (entry there
        // flows through the drawer's score CTA); editable in the table.
        const editable = info.meta?.editable !== false;

        const shouldBlur = shouldBlurScore(info.row.id, info.column.id);
        // Gallery poster cards blur unrated scores but must not reveal them on
        // click — reveal there flows through the details drawer's own pill.
        const revealOnClick = shouldBlur && info.meta?.revealable !== false;

        return h(
          "div",
          {
            class: revealOnClick ? "cursor-pointer hover:text-xl" : "",
            onClick: revealOnClick ? () => toggleReveal(info.row.id) : undefined,
          },
          [
            h(ReviewScore, {
              workId: info.row.original.id,
              memberId: member.id,
              score,
              reviewId: info.row.original.scores[member.id]?.id,
              size,
              editable,
              class: shouldBlur
                ? revealOnClick
                  ? "filter blur cursor-pointer"
                  : "filter blur"
                : "",
            }),
          ],
        );
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor((row) => row.scores.average?.score, {
    id: "score_average",
    header: (context) => {
      let size = "w-16";
      if (typeof context.meta?.size === "string") {
        size = context.meta.size === "sm" ? "w-7 h-7" : "w-16";
      }

      if (isTrue(context.meta?.showName)) {
        return h("div", { class: "flex min-w-0 items-center gap-2" }, [
          h("img", { src: AverageImg, class: `${size} max-w-none` }),
          h("span", { class: "truncate" }, "Average"),
        ]);
      } else {
        return h("img", { src: AverageImg, class: `${size} max-w-none` });
      }
    },
    cell: (info) => {
      const review = info.getValue();
      if (review === undefined) {
        return "";
      }

      const shouldBlur = shouldBlurScore(info.row.id, info.column.id);
      const revealOnClick = shouldBlur && info.meta?.revealable !== false;

      return h(
        "div",
        {
          class: shouldBlur
            ? revealOnClick
              ? "font-bold text-lg text-primary filter blur cursor-pointer"
              : "font-bold text-lg text-primary filter blur"
            : "font-bold text-lg text-primary",
          onClick: revealOnClick ? () => toggleReveal(info.row.id) : undefined,
        },
        Math.round(review * 100) / 100,
      );
    },
    sortUndefined: "last",
  }),
]);

const reviewTable = useVueTable({
  get columns() {
    return columns.value;
  },
  get data() {
    return filteredReviews.value ?? [];
  },
  getCoreRowModel: getCoreRowModel<DetailedReviewListItem>(),
  getSortedRowModel: getSortedRowModel<DetailedReviewListItem>(),
  getRowId: (row) => row.id,
});
</script>
