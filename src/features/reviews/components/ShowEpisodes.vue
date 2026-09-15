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

    <div class="mb-3 flex items-center gap-4">
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

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <ScoreChips
        v-if="showEntries.length > 0"
        class="min-w-0 max-w-md flex-grow"
        :entries="showEntries"
        :current-user-id="currentUserId"
        :revealed="hasOwnScore(show.scores, currentUserId)"
      />
      <v-btn @click="openLevel = 'show'">Score show</v-btn>
    </div>

    <p v-if="show.seasons.length === 0" class="text-sm text-gray-400">
      This show's seasons haven't loaded yet.
    </p>

    <template v-if="isDefined(season)">
      <div class="mb-3 flex flex-wrap items-center gap-3">
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
            :aria-label="`${option.title}, ${rollupLabel(option.scores)}`"
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
        <v-btn @click="openLevel = 'season'">Score season</v-btn>
      </div>

      <ScoreChips
        v-if="seasonEntries.length > 0"
        class="mb-4 max-w-md"
        :entries="seasonEntries"
        :current-user-id="currentUserId"
        :revealed="hasOwnScore(season.scores, currentUserId)"
      />
    </template>

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
      v-if="isDefined(opened)"
      :key="opened.key"
      :movie="opened.work"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      :save-score="opened.saveScore"
      @toggle-reveal="emit('toggle-reveal', $event)"
      @close="closeDrawer"
    />
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem, ReviewScores } from "../../../../lib/types/lists";
import {
  buildEpisodeCards,
  EpisodeCard as EpisodeCardData,
  episodePreview,
  seasonPreview,
  withMemberScore,
} from "../episodeCards";
import { hasOwnScore, scoreEntries } from "../reviewScores";
import { ShowNode } from "../reviewTree";
import EpisodeCard from "./EpisodeCard.vue";
import ScoreChips from "./ScoreChips.vue";
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
    const reviews = [season.review, ...season.episodes.map((episode) => episode.review)];
    for (const review of reviews.filter(isDefined)) {
      if (latest === undefined || review.createdDate > latest.date) {
        latest = { date: review.createdDate, seasonNumber: season.seasonNumber };
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

const rollupLabel = (scores: ReviewScores) =>
  isDefined(scores.average) ? `average ${formatRollup(scores)}` : "no scores yet";

const coverage = (scored: number, total: number) => `${scored}/${total} episodes`;

const showEntries = computed(() =>
  scoreEntries(props.show.scores, props.members, props.show.averagedMemberIds),
);
const seasonEntries = computed(() =>
  isDefined(season.value)
    ? scoreEntries(season.value.scores, props.members, season.value.averagedMemberIds)
    : [],
);

// -- Pending scores ---------------------------------------------------------
// A season or episode nobody has scored has no work on the reviews list for
// the usual optimistic update to write into, so a save shows here, keyed by
// its address within the show, until the refetched list carries it.

const pendingScores = ref(new Map<string, number>());
const pendingKey = (seasonNumber: number, episodeNumber?: number) =>
  isDefined(episodeNumber) ? `${seasonNumber}:${episodeNumber}` : `${seasonNumber}`;

const markPending = (key: string, score: number) => {
  pendingScores.value = new Map([...pendingScores.value, [key, score]]);
  return () => {
    // A later save on the same work owns the entry now; leave it be.
    if (pendingScores.value.get(key) !== score) return;
    pendingScores.value = new Map([...pendingScores.value].filter(([other]) => other !== key));
  };
};

/** `scores` with the reader's in-flight save written in, if they have one. */
const withPending = (scores: ReviewScores, key: string) => {
  const pending = pendingScores.value.get(key);
  const userId = props.currentUserId;
  return isDefined(pending) && isDefined(userId)
    ? withMemberScore(scores, userId, pending)
    : scores;
};

const cardViews = computed(() => {
  const seasonNumber = season.value?.seasonNumber;
  return cards.value.map((card) => {
    const key = isDefined(seasonNumber) ? pendingKey(seasonNumber, card.episodeNumber) : "";
    const scores = withPending(card.node?.review.scores ?? {}, key);
    const ownScore = hasOwnScore(scores, props.currentUserId);
    return {
      card,
      entries: scoreEntries(scores, props.members),
      // Everyone else's scores stay hidden until you have scored the episode
      // yourself, or revealed them from its details drawer.
      revealed: ownScore || (isDefined(card.node) && props.revealedMovieIds.has(card.node.workId)),
      scores,
      canScore: card.aired && isDefined(props.currentUserId) && !ownScore,
      pending: pendingScores.value.has(key),
    };
  });
});

// -- The details drawer -------------------------------------------------------
// The show, the selected season and each episode open in the same drawer. A
// season or episode on the reviews list opens as itself; one nobody has
// scored yet opens as a preview, scored through the show until that save
// lists it — the key stays put, so the drawer switches to the real work in
// place.

const openLevel = ref<"show" | "season">();
const selectedEpisodeNumber = ref<number>();

const selectCard = (card: EpisodeCardData) => {
  if (card.aired) selectedEpisodeNumber.value = card.episodeNumber;
};

const closeDrawer = () => {
  openLevel.value = undefined;
  selectedEpisodeNumber.value = undefined;
};

const clubSlug = useClubSlug();
const submitScore = useSubmitScore(clubSlug);

/** Saves a score on a season or episode that is not a work yet, through the show. */
const scoreThroughShow = (seasonNumber: number, episodeNumber?: number) => (score: number) => {
  const settle = markPending(pendingKey(seasonNumber, episodeNumber), score);
  submitScore(
    { workId: props.show.workId, score, seasonNumber, episodeNumber },
    { onSettled: settle },
  );
};

interface OpenedWork {
  key: string;
  work: DetailedReviewListItem;
  saveScore?: (score: number) => void;
}

const openSeason = computed<OpenedWork | undefined>(() => {
  const current = season.value;
  if (!isDefined(current)) return undefined;
  const key = `season-${current.seasonNumber}`;
  if (isDefined(current.review)) return { key, work: current.review };

  const scores = withPending({}, pendingKey(current.seasonNumber));
  return {
    key,
    work: seasonPreview(props.show.data, current, tmdbSeason.value, scores),
    saveScore: scoreThroughShow(current.seasonNumber),
  };
});

const openEpisode = computed<OpenedWork | undefined>(() => {
  const seasonNumber = season.value?.seasonNumber;
  const view = cardViews.value.find(
    (option) => option.card.episodeNumber === selectedEpisodeNumber.value,
  );
  if (!isDefined(view) || !isDefined(seasonNumber)) return undefined;

  const { card } = view;
  const key = `episode-${card.episodeNumber}`;
  if (isDefined(card.node)) return { key, work: card.node.review };
  return {
    key,
    work: episodePreview(props.show.data, seasonNumber, card, view.scores),
    saveScore: scoreThroughShow(seasonNumber, card.episodeNumber),
  };
});

const opened = computed<OpenedWork | undefined>(() => {
  if (openLevel.value === "show") return { key: "show", work: props.show.review };
  if (openLevel.value === "season") return openSeason.value;
  return openEpisode.value;
});
</script>
