<template>
  <div class="text-left">
    <button
      type="button"
      class="mb-4 flex items-center gap-1 whitespace-nowrap rounded-full border border-white py-1 pl-2 pr-4 hover:bg-lowBackground"
      @click="emit('back')"
    >
      <mdicon name="chevron-left" />
      <span>All shows</span>
    </button>

    <div class="mb-5 flex items-center gap-4">
      <img
        v-if="hasValue(show.imageUrl)"
        :src="show.imageUrl"
        alt=""
        class="h-[120px] w-20 shrink-0 rounded-md object-cover"
      />
      <div class="min-w-0 flex-grow">
        <h2 class="text-2xl font-bold">{{ show.title }}</h2>
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
    </div>

    <p v-if="show.seasons.length === 0" class="text-sm text-gray-400">
      This show's seasons haven't loaded yet.
    </p>

    <div v-if="isDefined(season)" class="mb-4 flex flex-wrap items-center gap-3">
      <div class="scrollbar-hide flex min-w-0 flex-grow gap-2 overflow-x-auto">
        <button
          v-for="option in show.seasons"
          :key="option.seasonNumber"
          type="button"
          class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-sm hover:bg-lowBackground"
          :class="
            option.seasonNumber === season.seasonNumber
              ? 'border-primary bg-primary/20 text-white'
              : 'border-white opacity-80'
          "
          :aria-pressed="option.seasonNumber === season.seasonNumber"
          @click="selectedSeasonNumber = option.seasonNumber"
        >
          <span>{{ option.title }}</span>
          <span
            class="font-bold"
            :class="isDefined(option.scores.average) ? 'text-primary' : 'text-gray-500'"
          >
            {{ formatRollup(option.scores) }}
          </span>
        </button>
      </div>
      <span class="text-xs text-gray-400">
        {{ coverage(season.scoredCount, season.episodeCount) }}
      </span>
      <v-btn @click="openSeasonFill(season)">Score all episodes</v-btn>
    </div>

    <p v-if="cards.length === 0 && isLoadingEpisodes" class="text-sm text-gray-400" role="status">
      Loading episodes…
    </p>
    <p v-else-if="cards.length === 0 && isEpisodesError" class="text-sm text-gray-400">
      Couldn't load this season's episodes.
    </p>

    <div class="grid w-full grid-cols-auto gap-4 text-center">
      <EpisodeCard
        v-for="view in cardViews"
        :key="view.card.episodeNumber"
        :card="view.card"
        :entries="view.entries"
        :revealed="view.revealed"
        :can-score="view.canScore"
        :pending="view.pending"
        :current-user-id="currentUserId"
        @select="selectCard(view.card)"
      />
    </div>

    <WorkDetailsDrawer
      v-if="isDefined(openEpisode)"
      :key="openEpisode.episodeNumber"
      :movie="openEpisode.work"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      :save-score="openEpisode.saveScore"
      @toggle-reveal="emit('toggle-reveal', $event)"
      @close="selectedEpisodeNumber = undefined"
    />

    <v-modal v-if="isDefined(seasonFill)" size="sm" @close="seasonFill = undefined">
      <div class="flex w-full flex-col gap-4">
        <h3 class="text-lg font-semibold">Score all of {{ seasonFill.title }}</h3>
        <p class="text-sm text-gray-300">
          Writes your score to every one of the {{ seasonFill.episodeCount }} episodes TMDB lists
          for this season.
        </p>
        <p v-if="replacedCount > 0" class="text-sm font-semibold text-highlightBackground">
          This replaces {{ replacedCount }} {{ replacedCount === 1 ? "score" : "scores" }} you set
          individually.
        </p>
        <ScoreDial v-model="draftScore" @save="confirmSeasonFill" />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md px-4 py-2 font-bold tracking-wide text-gray-300"
            @click="seasonFill = undefined"
          >
            Cancel
          </button>
          <v-btn :disabled="!canSave" @click="confirmSeasonFill">
            Score {{ seasonFill.episodeCount }} episodes
          </v-btn>
        </div>
      </div>
    </v-modal>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { ReviewScores } from "../../../../lib/types/lists";
import {
  buildEpisodeCards,
  EpisodeCard as EpisodeCardData,
  episodePreview,
  withMemberScore,
} from "../episodeCards";
import { scoreEntries } from "../reviewScores";
import { SeasonNode, ShowNode } from "../reviewTree";
import { isValidScore } from "../scoreScale";
import EpisodeCard from "./EpisodeCard.vue";
import ScoreDial from "./ScoreDial.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useClubSlug } from "@/service/useClub";
import { useSubmitScore } from "@/service/useReviews";
import { useTvSeason } from "@/service/useTMDB";

const props = defineProps<{
  show: ShowNode;
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "toggle-reveal", workId: string): void;
}>();

/** The season a member is most likely picking up: the one holding the club's
 * latest review, or the first season before anything has been scored. */
function currentSeasonNumber(show: ShowNode): number | undefined {
  let latest: { date: string; seasonNumber: number } | undefined;
  for (const season of show.seasons) {
    for (const episode of season.episodes) {
      if (latest === undefined || episode.review.createdDate > latest.date) {
        latest = { date: episode.review.createdDate, seasonNumber: season.seasonNumber };
      }
    }
  }
  return latest?.seasonNumber ?? show.seasons[0]?.seasonNumber;
}

const selectedSeasonNumber = ref(currentSeasonNumber(props.show));
const season = computed(() =>
  props.show.seasons.find((option) => option.seasonNumber === selectedSeasonNumber.value),
);

const {
  data: tmdbSeason,
  isLoading: isLoadingEpisodes,
  isError: isEpisodesError,
} = useTvSeason(
  computed(() => props.show.showId),
  selectedSeasonNumber,
);

const today = DateTime.now().toISODate() ?? "";

const cards = computed(() => {
  const current = season.value;
  if (!isDefined(current)) return [];
  return buildEpisodeCards(
    current.seasonNumber,
    tmdbSeason.value?.episodes,
    current.episodes,
    today,
  );
});

const formatRollup = (scores: ReviewScores) =>
  isDefined(scores.average) ? scores.average.score.toFixed(1) : "—";

const coverage = (scored: number, total: number) => `${scored}/${total} episodes`;

// -- Pending scores ---------------------------------------------------------
// An episode nobody has scored has no work on the reviews list for the usual
// optimistic update to write into, so a save shows here, keyed by episode,
// until the refetched list carries it.

const pendingScores = ref(new Map<string, number>());
const pendingKey = (seasonNumber: number, episodeNumber: number) =>
  `${seasonNumber}:${episodeNumber}`;

const markPending = (keys: string[], score: number) => {
  pendingScores.value = new Map([
    ...pendingScores.value,
    ...keys.map((key) => [key, score] as const),
  ]);
  return () => {
    // A later save on the same episode owns the entry now; leave it be.
    pendingScores.value = new Map(
      [...pendingScores.value].filter(([key, value]) => !keys.includes(key) || value !== score),
    );
  };
};

const cardViews = computed(() => {
  const seasonNumber = season.value?.seasonNumber;
  const userId = props.currentUserId;
  return cards.value.map((card) => {
    const pending = isDefined(seasonNumber)
      ? pendingScores.value.get(pendingKey(seasonNumber, card.episodeNumber))
      : undefined;
    const listedScores = card.node?.review.scores ?? {};
    const scores =
      isDefined(pending) && isDefined(userId)
        ? withMemberScore(listedScores, userId, pending)
        : listedScores;
    const hasOwnScore = isDefined(userId) && isDefined(scores[userId]);
    return {
      card,
      entries: scoreEntries(scores, props.members),
      // Everyone else's scores stay hidden until you have scored the episode
      // yourself, or revealed them from its details drawer.
      revealed:
        hasOwnScore || (isDefined(card.node) && props.revealedMovieIds.has(card.node.workId)),
      scores,
      canScore: card.aired && isDefined(userId) && !hasOwnScore,
      pending: isDefined(pending),
    };
  });
});

// -- Opening an episode -------------------------------------------------------

const selectedEpisodeNumber = ref<number>();

const selectCard = (card: EpisodeCardData) => {
  if (card.aired) selectedEpisodeNumber.value = card.episodeNumber;
};

const clubSlug = useClubSlug();
const submitScore = useSubmitScore(clubSlug);

/** An episode on the reviews list opens as itself. One nobody has scored yet
 * opens as a preview, scored through the show until that save lists it. */
const openEpisode = computed(() => {
  const seasonNumber = season.value?.seasonNumber;
  const view = cardViews.value.find(
    (option) => option.card.episodeNumber === selectedEpisodeNumber.value,
  );
  if (!isDefined(view) || !isDefined(seasonNumber)) return undefined;

  const { card } = view;
  if (isDefined(card.node)) {
    return { episodeNumber: card.episodeNumber, work: card.node.review, saveScore: undefined };
  }
  return {
    episodeNumber: card.episodeNumber,
    work: episodePreview(props.show.data, seasonNumber, card, view.scores),
    saveScore: (score: number) => {
      const settle = markPending([pendingKey(seasonNumber, card.episodeNumber)], score);
      submitScore(
        { workId: props.show.workId, score, seasonNumber, episodeNumber: card.episodeNumber },
        { onSettled: settle },
      );
    },
  };
});

// -- Scoring a whole season ---------------------------------------------------

const seasonFill = ref<SeasonNode>();
const draftScore = ref("");
const canSave = computed(() => isValidScore(Number.parseFloat(draftScore.value)));

const openSeasonFill = (target: SeasonNode) => {
  draftScore.value = "";
  seasonFill.value = target;
};

/** How many episodes of the season the member has already scored by hand —
 * the fill overwrites them, so the dialog says so before it does. */
const replacedCount = computed(() => {
  const target = seasonFill.value;
  const userId = props.currentUserId;
  if (!isDefined(target) || !isDefined(userId)) return 0;
  return target.episodes.filter((episode) => isDefined(episode.review.scores[userId])).length;
});

const confirmSeasonFill = () => {
  const target = seasonFill.value;
  const score = Number.parseFloat(draftScore.value);
  if (!isDefined(target) || !isValidScore(score)) return;

  // Addressed to the show plus the season; the server resolves which episodes
  // that means.
  const seasonNumber = target.seasonNumber;
  const settle = markPending(
    cards.value.map((card) => pendingKey(seasonNumber, card.episodeNumber)),
    score,
  );
  submitScore({ workId: props.show.workId, score, seasonNumber }, { onSettled: settle });
  seasonFill.value = undefined;
};
</script>
