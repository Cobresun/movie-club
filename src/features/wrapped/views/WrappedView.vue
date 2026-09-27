<template>
  <!-- Covers the app chrome, story-style, so the card can use the whole screen. -->
  <div class="fixed inset-0 z-40 flex flex-col bg-background">
    <h1 class="sr-only">{{ club?.clubName }} Wrapped</h1>
    <div class="flex items-center gap-2 px-3 pt-3">
      <router-link
        :to="{ name: 'Statistics', params: { clubSlug } }"
        aria-label="Close Wrapped"
        class="shrink-0 rounded-full p-1.5 text-white transition hover:bg-white/10"
      >
        <mdicon name="close" :size="28" />
      </router-link>
      <nav
        v-if="years.length > 0"
        ref="yearNav"
        aria-label="Wrapped years"
        class="min-w-0 flex-1 overflow-x-auto"
      >
        <div class="mx-auto flex w-max gap-2 px-1 py-1">
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
        </div>
      </nav>
    </div>

    <div class="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
      <SkeletonBlock
        v-if="isLoading"
        class="mx-auto mt-8 aspect-[9/16] max-h-[640px] max-w-full flex-1 rounded-2xl"
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
        <EmptyState
          v-if="deck.length === 0"
          :title="`Nothing to wrap for ${selectedYear}`"
          :description="`Your club didn't score any ${noun}s in ${selectedYear}.`"
        />
        <WrappedStory
          v-else
          :key="selectedYear"
          class="min-h-0 flex-1"
          :cards="deck"
          :club-name="club.clubName"
          :year="selectedYear"
          :file-name="`${clubSlug}-wrapped-${selectedYear}`"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

// A club with many years scrolls the chip row; bring the open year into view
// when it is one further along the row, e.g. a link straight to an old year.
const yearNav = ref<HTMLElement>();
watch(
  [selectedYear, yearNav],
  () => {
    yearNav.value
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  },
  { flush: "post" },
);

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
