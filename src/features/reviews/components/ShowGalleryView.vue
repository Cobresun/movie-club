<template>
  <div class="w-full md:px-6">
    <div v-if="shows.length === 0" class="text-gray-400">No shows match the current filters.</div>

    <div class="flex flex-col gap-4">
      <div v-for="show in shows" :key="show.workId" class="overflow-hidden rounded-lg bg-slate-700">
        <button
          type="button"
          class="flex w-full items-center gap-4 p-4 text-left"
          :aria-expanded="openShowId === show.showId"
          @click="toggleShow(show.showId)"
        >
          <img
            v-if="hasValue(show.imageUrl)"
            v-lazy-load
            :src="show.imageUrl"
            :alt="show.title"
            class="h-[90px] w-[60px] shrink-0 rounded-md object-cover"
          />
          <div
            v-else
            class="flex h-[90px] w-[60px] shrink-0 items-center justify-center rounded-md bg-background"
          >
            <mdicon name="television-classic" :size="24" class="text-slate-500" />
          </div>

          <div class="min-w-0 flex-grow">
            <h3 class="truncate text-xl font-semibold">{{ show.title }}</h3>
            <div class="text-sm text-gray-400">{{ show.metaLine }}</div>
          </div>

          <div class="text-right">
            <div
              class="text-2xl font-bold"
              :class="isDefined(show.scores.average) ? 'text-primary' : 'text-gray-500'"
            >
              {{ formatRollup(show.scores) }}
            </div>
            <div class="text-xs text-gray-400">
              {{ coverage(show.scoredCount, show.episodeCount) }}
            </div>
          </div>

          <mdicon
            name="chevron-down"
            class="transition-transform duration-fast ease-standard"
            :class="openShowId === show.showId ? '' : '-rotate-90'"
          />
        </button>

        <div v-if="openShowId === show.showId" class="flex flex-col gap-2 px-4 pb-4">
          <div
            v-for="season in show.seasons"
            :key="season.seasonNumber"
            class="rounded-md bg-secondary/40"
          >
            <div class="flex items-center gap-3 p-2">
              <button
                type="button"
                class="flex min-w-0 flex-grow items-center gap-3 text-left"
                :aria-expanded="isSeasonOpen(show.showId, season.seasonNumber)"
                @click="toggleSeason(show.showId, season.seasonNumber)"
              >
                <mdicon
                  name="chevron-down"
                  :size="20"
                  class="transition-transform duration-fast ease-standard"
                  :class="isSeasonOpen(show.showId, season.seasonNumber) ? '' : '-rotate-90'"
                />
                <span class="font-semibold">{{ season.title }}</span>
                <span
                  class="text-xl font-bold"
                  :class="isDefined(season.scores.average) ? 'text-primary' : 'text-gray-500'"
                >
                  {{ formatRollup(season.scores) }}
                </span>
                <span class="text-xs text-gray-400">
                  {{ coverage(season.scoredCount, season.episodeCount) }}
                </span>
              </button>

              <v-btn
                :disabled="isFilling"
                :title="`Score every episode of ${season.title}`"
                @click="openFill(show, season)"
              >
                Score all episodes
              </v-btn>
            </div>

            <div v-if="isSeasonOpen(show.showId, season.seasonNumber)">
              <p v-if="season.episodes.length === 0" class="px-3 pb-3 text-sm text-gray-400">
                Nobody has scored this season yet.
              </p>
              <button
                v-for="episode in season.episodes"
                :key="episode.workId"
                type="button"
                class="flex w-full items-center gap-3 border-t border-background p-2 text-left hover:bg-lowBackground"
                @click="selectedEpisodeId = episode.workId"
              >
                <span class="w-9 shrink-0 text-xs text-gray-400">
                  {{ episodeLabel(season.seasonNumber, episode.episodeNumber) }}
                </span>
                <span class="min-w-0 flex-grow">
                  <span class="block truncate font-medium">{{ episode.title }}</span>
                  <span class="block text-xs text-gray-500">{{ episodeSubtitle(episode) }}</span>
                </span>
                <span class="flex items-center gap-1.5">
                  <span
                    v-for="entry in workScoreEntries(episode.review, members)"
                    :key="entry.id"
                    class="flex items-center rounded-3xl bg-slate-600 pr-2"
                  >
                    <ScoreLabel :entry="entry" />
                    <span
                      class="text-sm"
                      :class="
                        isScoreBlurred(entry, currentUserId, isRevealed(episode.workId))
                          ? 'blur filter'
                          : ''
                      "
                      >{{ entry.value }}</span
                    >
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <WorkDetailsDrawer
      v-if="selectedEpisode"
      :key="selectedEpisode.id"
      :movie="selectedEpisode"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @toggle-reveal="emit('toggle-reveal', $event)"
      @close="selectedEpisodeId = undefined"
    />

    <v-modal v-if="isDefined(fillTarget)" @close="fillTarget = undefined">
      <div class="flex w-full max-w-sm flex-col gap-4 p-2">
        <h3 class="text-lg font-semibold">Score all of {{ fillTarget.season.title }}</h3>
        <p class="text-sm text-gray-300">
          Writes your score to every one of the {{ fillTarget.season.episodeCount }} episodes TMDB
          lists for this season.
        </p>
        <p v-if="replacedCount > 0" class="text-sm font-semibold text-highlightBackground">
          This replaces {{ replacedCount }} {{ replacedCount === 1 ? "score" : "scores" }} you set
          individually.
        </p>
        <ScoreDial v-model="fillScore" @save="confirmFill" />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md px-4 py-2 font-bold tracking-wide text-gray-300"
            @click="fillTarget = undefined"
          >
            Cancel
          </button>
          <v-btn :disabled="!canFill" @click="confirmFill">
            Score {{ fillTarget.season.episodeCount }} episodes
          </v-btn>
        </div>
      </div>
    </v-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { episodeCode } from "../../../../lib/types/tv";
import { isScoreBlurred, workScoreEntries } from "../reviewScores";
import { buildShowTree, EpisodeNode, SeasonNode, ShowNode } from "../reviewTree";
import { isValidScore } from "../scoreScale";
import ScoreDial from "./ScoreDial.vue";
import ScoreLabel from "./ScoreLabel.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { Member } from "@/../lib/types/club";
import { formatDate } from "@/common/workDisplay";
import { useClubSlug } from "@/service/useClub";
import { useSubmitScore } from "@/service/useReviews";

const props = defineProps<{
  reviews: DetailedReviewListItem[];
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", workId: string): void;
}>();

const shows = computed(() => buildShowTree(props.reviews));

const selectedEpisodeId = ref<string>();
const selectedEpisode = computed(() =>
  props.reviews.find((review) => review.id === selectedEpisodeId.value),
);

const openShowId = ref<string>();
const openSeasonKey = ref<string>();

const toggleShow = (showId: string) => {
  openShowId.value = openShowId.value === showId ? undefined : showId;
};

const seasonKey = (showId: string, seasonNumber: number) => `${showId}:${seasonNumber}`;
const isSeasonOpen = (showId: string, seasonNumber: number) =>
  openSeasonKey.value === seasonKey(showId, seasonNumber);
const toggleSeason = (showId: string, seasonNumber: number) => {
  const key = seasonKey(showId, seasonNumber);
  openSeasonKey.value = openSeasonKey.value === key ? undefined : key;
};

const isRevealed = (workId: string) => props.revealedMovieIds.has(workId);

const formatRollup = (scores: DetailedReviewListItem["scores"]) =>
  isDefined(scores.average) ? scores.average.score.toFixed(1) : "—";

const coverage = (scored: number, total: number) => `${scored}/${total} episodes`;

const episodeLabel = (seasonNumber: number, episodeNumber: number) =>
  episodeCode(seasonNumber, episodeNumber);

const episodeSubtitle = (episode: EpisodeNode) =>
  hasValue(episode.airDate) ? formatDate(episode.airDate) : "";

// -- Season fill -----------------------------------------------------------

const clubSlug = useClubSlug();
const submitScore = useSubmitScore(clubSlug);

const fillTarget = ref<{ show: ShowNode; season: SeasonNode }>();
const fillScore = ref("");
const isFilling = ref(false);

const canFill = computed(() => isValidScore(Number.parseFloat(fillScore.value)));

/** How many episodes of this season the member has already scored by hand —
 * the fill overwrites them, so the dialog says so before it does. */
const replacedCount = computed(() => {
  const target = fillTarget.value;
  const userId = props.currentUserId;
  if (!isDefined(target) || !isDefined(userId)) return 0;
  return target.season.episodes.filter((episode) => isDefined(episode.review.scores[userId]))
    .length;
});

const openFill = (show: ShowNode, season: SeasonNode) => {
  fillScore.value = "";
  fillTarget.value = { show, season };
};

const confirmFill = () => {
  const target = fillTarget.value;
  const score = Number.parseFloat(fillScore.value);
  if (!isDefined(target) || !isValidScore(score)) return;

  isFilling.value = true;
  // The season is addressed by the show's work plus the season the member
  // picked; the server resolves that to the episodes themselves.
  submitScore({
    workId: target.show.workId,
    score,
    seasonNumber: target.season.seasonNumber,
  });
  isFilling.value = false;
  fillTarget.value = undefined;
};
</script>
