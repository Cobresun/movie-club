<template>
  <div class="p-2 text-center">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <score-assist-modal
      v-if="isDefined(scoreAssistTarget)"
      :key="scoreAssistTarget.id"
      :target="scoreAssistTarget"
      :candidates="scoreAssistCandidates"
      :club-type="club?.type ?? ClubType.movie"
      :current-club-id="club?.clubId"
      @close="scoreAssistWorkId = undefined"
    />
    <page-header :has-back="false" page-name="Reviews" />
    <ReviewsSkeleton v-if="loading" />
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
        :reviews="filteredReviews"
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
import { computed, ref, provide } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import GalleryView from "../components/GalleryView.vue";
import ReviewsSkeleton from "../components/ReviewsSkeleton.vue";
import ScoreAssistModal from "../components/ScoreAssistModal.vue";
import { buildCandidatePool, isScoreAssistEligible } from "../composables/scoreAssistLogic";
import { ScoreAssistKey } from "../scoreAssist";
import { clubTypeConfig } from "@/common/clubType";
import EmptyState from "@/common/components/EmptyState.vue";
import SearchFilterBar from "@/common/components/SearchFilterBar.vue";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useClub, useMembers } from "@/service/useClub";
import { useDeleteReview, useReviewsList, useReviewsListId } from "@/service/useList";
import { useMemberScores, useUser } from "@/service/useUser";

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
const { data: memberScores } = useMemberScores();
const scoreAssistCandidates = computed(() => {
  const target = scoreAssistTarget.value;
  if (!isDefined(target)) return [];
  return buildCandidatePool(memberScores.value ?? [], target);
});
provide(ScoreAssistKey, {
  isEligible: (workId: string) =>
    isScoreAssistEligible(
      memberScores.value,
      reviews.value?.find((review) => review.id === workId),
    ),
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
</script>
