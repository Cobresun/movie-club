<template>
  <div class="relative min-h-screen pb-24">
    <header
      class="bg-gradient-to-b from-secondary/40 to-transparent px-6 pb-10 pt-6"
    >
      <div class="mx-auto max-w-6xl">
        <a
          href="/"
          class="mx-auto flex w-fit items-center gap-1.5 text-highlight transition hover:brightness-110"
        >
          <span aria-hidden="true">🍿</span>
          <span class="font-semibold tracking-wide">MovieClub</span>
        </a>

        <div class="mt-8 flex flex-col items-center text-center">
          <v-avatar
            :name="club?.clubName ?? clubSlug"
            :size="72"
            class="rounded-full ring-2 ring-secondary"
          />
          <p
            class="mt-4 text-xs font-semibold uppercase tracking-widest text-primary"
          >
            Statistics
          </p>
          <h1 class="mt-1 text-4xl font-bold text-white">
            {{ club?.clubName ?? clubSlug }}
          </h1>

          <div
            v-if="members.length > 0"
            class="mt-4 flex items-center -space-x-2"
          >
            <v-avatar
              v-for="member in visibleMembers"
              :key="member.id"
              :src="member.image"
              :name="member.name"
              :size="32"
              class="rounded-full ring-2 ring-background"
            />
            <div
              v-if="extraMemberCount > 0"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-lowBackground text-xs font-semibold text-slate-300 ring-2 ring-background"
            >
              +{{ extraMemberCount }}
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-6xl space-y-6 px-6 pt-6">
      <loading-spinner v-if="loading" />

      <EmptyState
        v-else-if="!hasReviews"
        title="No Statistics Yet"
        description="Statistics will appear once this club has reviewed some movies."
      />

      <div v-else>
        <div class="mb-4 flex items-center justify-center gap-2">
          <mdicon name="view-dashboard" />
          <VToggle v-model="showScoresView" />
          <mdicon name="table" />
        </div>

        <InsightsView
          v-if="!showScoresView"
          :movie-data="movieData"
          :members="members"
          :histogram-data="histogramData"
        />
        <ScoresView
          v-else
          :filtered-movie-data="filteredMovieData"
          :members="members"
          :search-term="searchTerm"
          :show-score-context="showScoreContext"
          :has-search-term="hasSearchTerm"
          @update:search-term="searchTerm = $event"
          @update:show-score-context="toggleScoreContext"
        />
      </div>
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

import InsightsView from "./InsightsView.vue";
import ScoresView from "./ScoresView.vue";
import { useStatisticsData } from "../composables/useStatisticsData";

import EmptyState from "@/common/components/EmptyState.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import VToggle from "@/common/components/VToggle.vue";
import { useClub } from "@/service/useClub";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;

const { data: club } = useClub(clubSlug);

const {
  loading,
  movieData,
  filteredMovieData,
  members,
  histogramData,
  searchTerm,
  showScoreContext,
  hasReviews,
  hasSearchTerm,
  toggleScoreContext,
} = useStatisticsData();

const showScoresView = ref(false);

const MAX_VISIBLE_MEMBERS = 6;
const visibleMembers = computed(() =>
  members.value.slice(0, MAX_VISIBLE_MEMBERS),
);
const extraMemberCount = computed(() =>
  Math.max(members.value.length - MAX_VISIBLE_MEMBERS, 0),
);
</script>
