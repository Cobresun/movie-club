<template>
  <div class="relative min-h-screen pb-24">
    <SharedPageHeader :club-name="club?.clubName ?? clubSlug" :members="data?.members ?? []" />

    <div class="px-6 pt-6">
      <SharedReviewSkeleton v-if="isLoading" />
      <div v-else-if="error" class="rounded-lg bg-red-900/50 p-4">
        <p class="text-center text-red-400">Failed to load review</p>
      </div>
      <div v-else-if="data" class="mx-auto max-w-6xl space-y-8">
        <!-- Work Details Section -->
        <div v-if="data.work" class="relative overflow-hidden rounded-lg">
          <!-- Backdrop Image (movies only) -->
          <div
            v-if="movieData?.backdrop_path"
            class="absolute inset-0 opacity-60"
            :style="`background-image: url(https://image.tmdb.org/t/p/w1280${movieData.backdrop_path}); background-size: cover; background-position: center; filter: blur(8px);`"
          />

          <div class="relative rounded-lg bg-slate-600/60 p-8 backdrop-blur-xs">
            <div class="flex flex-col gap-8">
              <div class="flex flex-col gap-8 sm:flex-row">
                <div class="flex shrink-0 flex-col sm:w-1/3">
                  <!-- Title and Tagline Section positioned over poster -->
                  <div class="mb-4">
                    <h1 class="mb-1 text-4xl font-bold wrap-break-word text-white">
                      {{ workTitle(data.work) }}
                    </h1>
                    <p v-if="movieData?.tagline" class="text-lg text-gray-300 italic">
                      "{{ movieData.tagline }}"
                    </p>
                  </div>

                  <!-- Cover / poster with fixed dimensions -->
                  <div>
                    <img
                      :src="posterSrc"
                      class="aspect-2/3 w-full rounded-lg object-cover shadow-lg transition-transform"
                    />
                  </div>
                </div>

                <!-- Reviews Section -->
                <div class="flex-1 space-y-4 self-center">
                  <!-- Ratings Box -->
                  <div class="mt-6 w-full rounded-lg bg-slate-800 p-6 shadow-inner">
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div class="flex items-center gap-3">
                        <mdicon name="star" class="h-8 w-8 text-yellow-500" />
                        <div>
                          <div class="flex flex-wrap items-baseline gap-2">
                            <span class="text-3xl font-bold text-white">{{
                              averageScore.toFixed(1)
                            }}</span>
                            <span class="text-lg text-gray-400"> Club Average </span>
                            <span class="text-sm text-gray-500"> ({{ ratingCount }} ratings) </span>
                          </div>
                        </div>
                      </div>

                      <div
                        v-if="movieData?.vote_average"
                        class="flex items-center gap-3 sm:border-l sm:border-gray-700 sm:pl-4"
                      >
                        <mdicon name="movie" class="h-8 w-8 text-blue-400" />
                        <div class="flex flex-wrap items-baseline gap-2">
                          <span class="text-3xl font-bold text-white">
                            {{ movieData.vote_average.toFixed(1) }}
                          </span>
                          <span class="text-lg text-gray-400">TMDB Score</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Same spotlight fact the club sees in the review drawer. -->
                  <ReviewFactCard v-if="isDefined(reviewFact)" :fact="reviewFact" />

                  <div
                    v-for="member in data.members"
                    :key="member.id"
                    class="rounded-lg bg-slate-800 p-4 shadow-inner"
                  >
                    <div class="flex items-center justify-between gap-4">
                      <div class="flex items-center gap-4">
                        <v-avatar :src="member.image" :name="member.name" class="h-12 w-12" />
                        <div>
                          <div class="font-medium text-white">
                            {{ member.name }}
                          </div>
                          <div class="text-sm text-gray-400">
                            {{
                              memberScore(member.id).averaged
                                ? "Episode average"
                                : formatReviewTime(memberScore(member.id).reviewedAt)
                            }}
                          </div>
                        </div>
                      </div>
                      <div class="flex shrink-0 items-baseline gap-2">
                        <div class="text-primary text-2xl font-bold whitespace-nowrap">
                          <template v-if="memberScore(member.id).averaged"
                            ><mdicon
                              name="approximately-equal"
                              :size="20"
                              class="inline-block align-middle text-gray-400"
                              aria-hidden="true"
                            /><span class="sr-only">Averaged </span></template
                          >{{ memberScore(member.id).score ?? "-" }}
                        </div>
                        <div class="text-base text-gray-400">/ 10</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <component
          :is="layout.breakdown"
          v-if="isDefined(layout.breakdown) && isDefined(allReviews)"
          :reviews="allReviews"
          :work-id="workId"
          :members="data.members"
        />

        <!-- Comments Section -->
        <SharedReviewComments v-if="hasElements(data.comments)" :comments="data.comments" />
      </div>
    </div>

    <SharedPageCtaBanner source="review" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { hasElements, isDefined } from "../../../../lib/checks/checks.js";
import ReviewFactCard from "../components/ReviewFactCard.vue";
import { computeReviewFact } from "../reviewFacts";
import { SHARED_REVIEW_LAYOUTS } from "../sharedReviewLayouts";
import { workTitle } from "@/common/clubType";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import SharedPageHeader from "@/common/components/SharedPageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import { formatIsoDate } from "@/common/dates";
import { asMovie, workPosterUrl } from "@/common/workDisplay";
import SharedReviewComments from "@/features/reviews/components/SharedReviewComments.vue";
import SharedReviewSkeleton from "@/features/reviews/components/SharedReviewSkeleton.vue";
import { useClub } from "@/service/useClub";
import { useReviewsList, useSharedReview } from "@/service/useList";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;
const workId = route.params.workId as string;

const { data: club } = useClub(clubSlug);
const { data, isLoading, error } = useSharedReview(clubSlug, workId);

// The reviews-list endpoint is public (it also powers the shared statistics
// page), so this anonymous page can compute the same spotlight fact the club
// sees in its review drawer.
const { data: allReviews } = useReviewsList(clubSlug);
const reviewFact = computed(() =>
  isDefined(allReviews.value) ? computeReviewFact(allReviews.value, workId) : undefined,
);

const layout = computed(() =>
  isDefined(club.value) ? SHARED_REVIEW_LAYOUTS[club.value.type] : {},
);

const rollup = computed(() =>
  isDefined(allReviews.value) ? layout.value.rollup?.(allReviews.value, workId) : undefined,
);

const movieData = computed(() => asMovie(data.value?.work.externalData));
const posterSrc = computed(
  () => workPosterUrl(data.value?.work.externalData, data.value?.work.imageUrl) ?? "",
);

const averageScore = computed(() => {
  if (isDefined(rollup.value)) return rollup.value.scores.average?.score ?? 0;
  if (!data.value) return 0;
  const scores = data.value.reviews.map((r) => Number(r.score)).filter(Boolean);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
});

const ratingCount = computed(() =>
  isDefined(rollup.value)
    ? Object.keys(rollup.value.scores).filter((memberId) => memberId !== "average").length
    : (data.value?.reviews.length ?? 0),
);

interface MemberScore {
  score?: number;
  reviewedAt?: string;
  /** Averaged from the member's scores one level down, not set on the work. */
  averaged: boolean;
}

const memberScore = (memberId: string): MemberScore => {
  if (isDefined(rollup.value)) {
    const review = rollup.value.scores[memberId];
    if (!isDefined(review)) return { averaged: false };
    return rollup.value.averagedMemberIds.has(memberId)
      ? { score: Number(review.score.toFixed(1)), averaged: true }
      : { score: review.score, reviewedAt: review.created_date, averaged: false };
  }
  const review = data.value?.reviews.find((r) => r.user_id === memberId);
  return { score: review?.score, reviewedAt: review?.created_date, averaged: false };
};

const formatReviewTime = (time?: string) => {
  if (time === undefined) return "";
  return formatIsoDate(time, "full") ?? time;
};
</script>
