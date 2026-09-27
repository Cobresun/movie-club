<template>
  <div class="px-4 pb-8 text-center">
    <page-header :has-back="true" back-route="Statistics" page-name="Wrapped" />

    <SkeletonBlock
      v-if="isLoading"
      class="mx-auto mt-12 aspect-[9/16] w-[min(100%,calc((100dvh-19rem)*9/16))] min-w-[16rem] rounded-2xl"
    />

    <EmptyState
      v-else-if="years.length === 0"
      title="Nothing to wrap yet"
      :description="`Wrapped appears once your club has scored some ${noun}s.`"
      action-label="Go to Reviews"
      action-icon="arrow-right"
      @action="goToReviews"
    />

    <template v-else-if="isDefined(club)">
      <nav aria-label="Wrapped years" class="mb-4 flex flex-wrap justify-center gap-2">
        <router-link
          v-for="year in years"
          :key="year"
          :to="{ name: 'Wrapped', params: { clubSlug, year } }"
          :aria-current="year === selectedYear ? 'page' : undefined"
          class="rounded-full px-3 py-1 text-sm font-semibold transition-colors duration-fast ease-standard"
          :class="
            year === selectedYear
              ? 'bg-primary text-white'
              : 'bg-lowBackground text-white/70 hover:text-white'
          "
        >
          {{ year }}
        </router-link>
      </nav>

      <EmptyState
        v-if="deck.length === 0"
        :title="`Nothing to wrap for ${selectedYear}`"
        :description="`Your club didn't score any ${noun}s in ${selectedYear}.`"
      />
      <WrappedStory
        v-else
        :key="selectedYear"
        :cards="deck"
        :club-name="club.clubName"
        :year="selectedYear"
        :file-name="`${clubSlug}-wrapped-${selectedYear}`"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";
import { useStatisticsData } from "../../statistics/composables/useStatisticsData";
import { isBookStats, isMovieStats } from "../../statistics/types";
import WrappedStory from "../components/WrappedStory.vue";
import { isYearInProgress, worksInYear, wrappedYears } from "../wrapped";
import { buildWrappedDeck } from "../wrappedDeck";
import { clubTypeConfig } from "@/common/clubType";
import EmptyState from "@/common/components/EmptyState.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { useClub, useClubSlug } from "@/service/useClub";

const props = defineProps<{ year?: string }>();

const clubSlug = useClubSlug();
const { data: club } = useClub(clubSlug);
const { loading, workData, members } = useStatisticsData();

const isLoading = computed(() => loading.value || !isDefined(club.value));

const noun = computed(() => (isDefined(club.value) ? clubTypeConfig(club.value.type).noun : ""));

const years = computed(() => wrappedYears(workData.value));

const selectedYear = computed(() => {
  const requested = Number.parseInt(props.year ?? "", 10);
  return Number.isNaN(requested) ? years.value[0] : requested;
});

const deck = computed(() => {
  if (!isDefined(club.value)) return [];
  const works = worksInYear(workData.value, selectedYear.value);
  if (works.length === 0) return [];
  return buildWrappedDeck({
    year: selectedYear.value,
    inProgress: isYearInProgress(selectedYear.value),
    clubType: club.value.type,
    workData: works,
    movieData: works.filter(isMovieStats),
    bookData: works.filter(isBookStats),
    members: members.value,
  });
});

const router = useRouter();

const goToReviews = () => {
  router.push({ name: "Reviews" }).catch(console.error);
};
</script>
