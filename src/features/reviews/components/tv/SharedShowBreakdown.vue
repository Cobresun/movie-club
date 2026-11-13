<template>
  <section
    v-if="isDefined(show) && scoredSeasons.length > 0"
    aria-labelledby="episode-breakdown-heading"
    class="space-y-4"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="episode-breakdown-heading" class="text-2xl font-bold text-white">
        Episode breakdown
      </h2>
      <span class="text-sm text-gray-400">
        {{ coverageLabel(show.scoredCount, show.episodeCount) }} scored
      </span>
    </div>

    <section
      v-for="season in scoredSeasons"
      :key="season.seasonNumber"
      :aria-labelledby="seasonHeadingId(season)"
      class="rounded-lg bg-slate-800 shadow-inner"
    >
      <!-- A season is never scored on its own: its number is the club's mean
           of each member's average over the episodes they scored. -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <div class="flex min-w-0 grow items-center gap-3">
          <span class="text-primary text-3xl leading-none font-bold">
            <span class="sr-only">Season average </span>{{ formatRollup(season.scores) }}
          </span>
          <div class="flex min-w-0 flex-col gap-1">
            <h3 :id="seasonHeadingId(season)" class="text-lg font-semibold text-white">
              {{ season.title }}
            </h3>
            <div class="flex items-center gap-2">
              <div
                class="h-1 w-16 overflow-hidden rounded-full bg-white/10 md:w-24"
                aria-hidden="true"
              >
                <div
                  class="bg-primary h-full rounded-full"
                  :style="{ width: `${coveragePercent(season.scoredCount, season.episodeCount)}%` }"
                />
              </div>
              <span class="text-xs text-white/55">
                {{ coverageLabel(season.scoredCount, season.episodeCount) }}
              </span>
            </div>
          </div>
        </div>
        <ScoreChips
          class="justify-start md:justify-end"
          row
          show-names
          revealed
          :entries="seasonMemberEntries(season)"
        />
      </div>

      <ol :aria-label="`${season.title} episodes`">
        <li
          v-for="episode in scoredEpisodes(season)"
          :key="episode.workId"
          class="flex items-center gap-3 border-t border-white/5 px-4 py-3"
        >
          <span class="w-9 shrink-0 text-xs font-semibold text-gray-400" aria-hidden="true">
            E{{ String(episode.episodeNumber).padStart(2, "0") }}
          </span>
          <div class="flex min-w-0 grow flex-col gap-1">
            <h4 class="text-sm leading-snug font-medium text-white">
              <span class="sr-only">Episode {{ episode.episodeNumber }}: </span>{{ episode.title }}
            </h4>
            <ScoreChips compact revealed :entries="memberEntries(episode.review.scores)" />
          </div>
          <div class="shrink-0 text-right">
            <div class="text-primary text-xl leading-tight font-bold">
              <span class="sr-only">Club average </span>{{ formatRollup(episode.review.scores) }}
            </div>
            <div class="text-[11px] text-white/55" aria-hidden="true">club avg</div>
          </div>
        </li>
      </ol>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "../../../../../lib/checks/checks.js";
import {
  type DetailedReviewListItem,
  type ReviewScores,
  type SharedReviewResponse,
} from "../../../../../lib/types/lists";
import { scoreEntries } from "../../reviewScores";
import {
  buildShowTree,
  coverageLabel,
  coveragePercent,
  formatRollup,
  type SeasonNode,
} from "../../reviewTree";
import ScoreChips from "../ScoreChips.vue";

const props = defineProps<{
  reviews: DetailedReviewListItem[];
  workId: string;
  members: SharedReviewResponse["members"];
}>();

const show = computed(() =>
  buildShowTree(props.reviews).find((candidate) => candidate.workId === props.workId),
);

const scoredSeasons = computed(
  () => show.value?.seasons.filter((season) => season.scoredCount > 0) ?? [],
);

const scoredEpisodes = (season: SeasonNode) => season.episodes.filter((episode) => episode.scored);

const seasonHeadingId = (season: SeasonNode) => `breakdown-season-${season.seasonNumber}`;

const memberEntries = (scores: ReviewScores) =>
  scoreEntries(scores, props.members).filter((entry) => isDefined(entry.memberId));

// Every member's number on a season is an average, so each reads to one decimal.
const seasonMemberEntries = (season: SeasonNode) =>
  memberEntries(season.scores).map((entry) => ({
    ...entry,
    value: Number(entry.value.toFixed(1)),
  }));
</script>
