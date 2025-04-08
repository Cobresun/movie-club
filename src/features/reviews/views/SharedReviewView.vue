<template>
  <div class="relative min-h-screen p-6 pb-24">
    <loading-spinner v-if="isLoading" />
    <div v-else-if="error" class="rounded-lg bg-red-900/50 p-4">
      <p class="text-center text-red-400">Failed to load review</p>
    </div>
    <div v-else-if="data" class="mx-auto max-w-6xl space-y-8">
      <!-- Work Details Section -->
      <div v-if="data.work" class="relative overflow-hidden rounded-lg">
        <!-- Backdrop Image -->
        <div
          v-if="data.work.externalData?.backdrop_path"
          class="absolute inset-0 opacity-60"
          :style="`background-image: url(https://image.tmdb.org/t/p/original${data.work.externalData.backdrop_path}); background-size: cover; background-position: center; filter: blur(8px);`"
        />

        <div class="relative rounded-lg bg-slate-600/60 p-8 backdrop-blur-sm">
          <div class="flex flex-col gap-8">
            <div class="flex flex-col gap-8 sm:flex-row">
              <div class="flex flex-shrink-0 flex-col sm:w-1/3">
                <!-- Title and Tagline Section positioned over poster -->
                <div class="mb-4">
                  <h1 class="mb-1 break-words text-4xl font-bold text-white">
                    {{ data.work.title }}
                  </h1>
                  <p
                    v-if="data.work.externalData?.tagline"
                    class="text-lg italic text-gray-300"
                  >
                    "{{ data.work.externalData.tagline }}"
                  </p>
                </div>

                <!-- Movie Poster with fixed dimensions -->
                <div>
                  <img
                    :src="`https://image.tmdb.org/t/p/w500/${data.work.externalData?.poster_path}`"
                    class="aspect-[2/3] w-full rounded-lg object-cover shadow-lg transition-transform"
                  />
                </div>
              </div>

              <!-- Reviews Section -->
              <div class="flex-1 space-y-4 self-center">
                <!-- Ratings Box -->
                <div
                  class="mt-6 w-full rounded-lg bg-slate-800 p-6 shadow-inner"
                >
                  <div
                    class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div class="flex items-center gap-3">
                      <mdicon name="star" class="h-8 w-8 text-yellow-500" />
                      <div>
                        <div class="flex flex-wrap items-baseline gap-2">
                          <span class="text-3xl font-bold text-white">{{
                            averageScore.toFixed(1)
                          }}</span>
                          <span class="text-lg text-gray-400">
                            Club Average
                          </span>
                          <span class="text-sm text-gray-500">
                            ({{ data.reviews.length }} ratings)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="data.work.externalData?.vote_average"
                      class="flex items-center gap-3 sm:border-l sm:border-gray-700 sm:pl-4"
                    >
                      <mdicon name="movie" class="h-8 w-8 text-blue-400" />
                      <div class="flex flex-wrap items-baseline gap-2">
                        <span class="text-3xl font-bold text-white">
                          {{ data.work.externalData.vote_average.toFixed(1) }}
                        </span>
                        <span class="text-lg text-gray-400">TMDB Score</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-for="member in data.members"
                  :key="member.id"
                  class="rounded-lg bg-slate-800 p-4 shadow-inner"
                >
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                      <v-avatar
                        :src="member.image_url"
                        :name="member.username"
                        class="h-12 w-12"
                      />
                      <div>
                        <div class="font-medium text-white">
                          {{ member.username }}
                        </div>
                        <div class="text-sm text-gray-400">
                          {{
                            formatReviewTime(getReviewTimeForMember(member.id))
                          }}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-baseline gap-2">
                      <div class="text-2xl font-bold text-primary">
                        {{ getScoreForMember(member.id) ?? "-" }}
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
    </div>

    <!-- Fixed Call-to-Action Banner -->
    <div v-if="!isLoggedIn">
      <div class="h-48" />
      <div class="fixed inset-x-0 bottom-0 bg-secondary px-6 py-8 shadow-lg">
        <div
          class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left"
        >
          <div>
            <h2 class="text-2xl font-bold text-white">Join the Club!</h2>
            <p class="text-sm text-gray-200">
              Create an account to join clubs with your friends and review your
              favourite movies.
            </p>
          </div>
          <a
            href="/"
            class="rounded-md bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary/80"
          >
            Sign Up Now
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed } from "vue";
import { useRoute } from "vue-router";

import LoadingSpinner from "@/common/components/LoadingSpinner.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import { useSharedReview } from "@/service/useList";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const clubId = route.params.clubId as string;
const workId = route.params.workId as string;

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { data, isLoading, error } = useSharedReview(clubId, workId);

const averageScore = computed(() => {
  if (!data.value) return 0;
  const scores = data.value.reviews.map((r) => Number(r.score)).filter(Boolean);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
});

const getScoreForMember = (memberId: string): number | undefined => {
  if (!data.value) return undefined;
  const review = data.value.reviews.find((r) => r.user_id === memberId);
  return review?.score;
};

const getReviewTimeForMember = (memberId: string): string | undefined => {
  if (!data.value) return undefined;
  const review = data.value.reviews.find((r) => r.user_id === memberId);
  return review?.created_date;
};

const formatReviewTime = (time?: string) => {
  if (time === undefined) return "";
  return DateTime.fromISO(time).toLocaleString(DateTime.DATE_FULL);
};
</script>
