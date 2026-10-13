<template>
  <section
    :id="seasonPanelId(show.showId, season.seasonNumber)"
    role="tabpanel"
    :aria-labelledby="seasonTabId(show.showId, season.seasonNumber)"
    class="animate-fade-up"
  >
    <div class="flex items-baseline gap-2 px-3 pt-3 md:pl-11 md:pr-3">
      <h3 class="font-semibold">{{ season.title }}</h3>
      <span class="text-xs text-white/55">
        {{ coverageLabel(season.scoredCount, season.episodeCount) }}
      </span>
    </div>
    <LevelScore
      label="Season score"
      noun="season"
      below="episodes"
      show-club
      chips-on-desktop
      :level="level"
      :entries="entries"
      :revealed="revealed"
      :target="seasonTarget"
      :current-user-id="currentUserId"
      @reveal="emit('toggle-reveal', revealKey)"
      @details="opened = 'season'"
    />

    <p
      v-if="cards.length === 0 && isLoadingEpisodes"
      class="px-3 pb-3 text-sm text-gray-400 md:pl-11"
      role="status"
    >
      Loading episodes…
    </p>
    <p
      v-else-if="cards.length === 0 && isEpisodesError"
      class="px-3 pb-3 text-sm text-gray-400 md:pl-11"
    >
      Couldn't load this season's episodes.
    </p>

    <ul :aria-label="`${season.title} episodes`">
      <EpisodeRow
        v-for="view in cardViews"
        :key="view.card.episodeNumber"
        :card="view.card"
        :entries="view.entries"
        :revealed="view.revealed"
        :can-score="view.canScore"
        :can-reveal="view.canReveal"
        :up-next="view.card.episodeNumber === upNext"
        :pending="view.pending"
        :score-target="view.target"
        :current-user-id="currentUserId"
        @details="opened = view.card.episodeNumber"
        @reveal="revealEpisode(view.card)"
      />
    </ul>

    <Teleport to="body">
      <WorkDetailsDrawer
        v-if="isDefined(openedWork)"
        :key="openedWork.key"
        :movie="openedWork.work"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRated"
        :current-user-id="currentUserId"
        :save-score="openedWork.saveScore"
        @toggle-reveal="emit('toggle-reveal', $event)"
        @close="opened = undefined"
      />
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem, ReviewScores } from "../../../../lib/types/lists";
import {
  buildEpisodeCards,
  EpisodeCard,
  episodePreview,
  ScoreTarget,
  seasonPreview,
  withMemberScore,
} from "../episodeCards";
import { hasOwnScore, isOthersScore, scoreEntries } from "../reviewScores";
import {
  coverageLabel,
  LevelScores,
  SeasonNode,
  seasonPanelId,
  seasonRevealKey,
  seasonTabId,
  ShowNode,
} from "../reviewTree";
import EpisodeRow from "./EpisodeRow.vue";
import LevelScore from "./LevelScore.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useClubSlug } from "@/service/useClub";
import { useSubmitScore } from "@/service/useReviews";
import { useTvSeason } from "@/service/useTMDB";

const props = defineProps<{
  show: ShowNode;
  season: SeasonNode;
  members: Member[];
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", workId: string): void;
}>();

// Only the selected season is mounted, so only its listing is fetched: a club
// deep into a long show would otherwise pull every season's just to draw the
// tabs.
const {
  data: tmdbSeason,
  isLoading: isLoadingEpisodes,
  isError: isEpisodesError,
} = useTvSeason(
  computed(() => props.show.showId),
  computed(() => props.season.seasonNumber),
);

const today = DateTime.now().toISODate() ?? "";

const cards = computed(() =>
  buildEpisodeCards(
    props.season.seasonNumber,
    tmdbSeason.value?.episodes,
    props.season.episodes,
    today,
  ),
);

// -- Pending scores ---------------------------------------------------------
// A season or episode nobody has scored has no work on the reviews list for
// the usual optimistic update to write into, so a save shows here, keyed by
// the episode number (or none, for the season itself), until the refetched
// list carries it.

const SEASON = "season";
type PendingKey = number | typeof SEASON;

const pendingScores = ref(new Map<PendingKey, number>());

const markPending = (key: PendingKey, score: number) => {
  pendingScores.value = new Map([...pendingScores.value, [key, score]]);
  return () => {
    // A later save on the same work owns the entry now; leave it be.
    if (pendingScores.value.get(key) !== score) return;
    pendingScores.value = new Map([...pendingScores.value].filter(([other]) => other !== key));
  };
};

/** `scores` with the reader's in-flight save written in, if they have one. */
const withPending = (scores: ReviewScores, key: PendingKey) => {
  const pending = pendingScores.value.get(key);
  const userId = props.currentUserId;
  return isDefined(pending) && isDefined(userId)
    ? withMemberScore(scores, userId, pending)
    : scores;
};

const clubSlug = useClubSlug();
const submitScore = useSubmitScore(clubSlug);

/** Saves a score on a season or episode that is not a work yet, through the show. */
const scoreThroughShow = (episodeNumber?: number) => (score: number) => {
  const settle = markPending(episodeNumber ?? SEASON, score);
  submitScore(
    {
      workId: props.show.workId,
      score,
      seasonNumber: props.season.seasonNumber,
      episodeNumber,
    },
    { onSettled: settle },
  );
};

/** Where a score entry saves to: the listed work, or — previewed as the work
 * it becomes — through the show. */
const targetFor = (
  review: DetailedReviewListItem | undefined,
  key: PendingKey,
  preview: () => DetailedReviewListItem,
  episodeNumber?: number,
): ScoreTarget => {
  const userId = props.currentUserId;
  if (isDefined(review)) {
    const own = isDefined(userId) ? review.scores[userId] : undefined;
    return { work: review, score: own?.score, reviewId: own?.id };
  }
  return {
    work: preview(),
    score: pendingScores.value.get(key),
    saveScore: scoreThroughShow(episodeNumber),
  };
};

// -- The season's own score ---------------------------------------------------

/** The season's scores, with a save still in flight standing in for the
 * reader's own — set now, so no longer averaged from their episodes. */
const level = computed<LevelScores>(() => {
  const userId = props.currentUserId;
  if (!pendingScores.value.has(SEASON) || !isDefined(userId)) return props.season;
  return {
    scores: withPending(props.season.scores, SEASON),
    averagedMemberIds: new Set([...props.season.averagedMemberIds].filter((id) => id !== userId)),
  };
});

const entries = computed(() =>
  scoreEntries(level.value.scores, props.members, level.value.averagedMemberIds),
);
const memberEntries = computed(() => entries.value.filter((entry) => isDefined(entry.memberId)));

const revealKey = computed(() => seasonRevealKey(props.show.showId, props.season));
const revealed = computed(
  () =>
    hasOwnScore(level.value.scores, props.currentUserId) ||
    props.revealedMovieIds.has(revealKey.value),
);

const seasonTarget = computed(() =>
  targetFor(props.season.review, SEASON, () =>
    seasonPreview(props.show.data, props.season, tmdbSeason.value, withPending({}, SEASON)),
  ),
);

// -- Episodes -----------------------------------------------------------------

const cardViews = computed(() =>
  cards.value.map((card) => {
    const scores = withPending(card.node?.review.scores ?? {}, card.episodeNumber);
    const ownScore = hasOwnScore(scores, props.currentUserId);
    const entries = scoreEntries(scores, props.members);
    // Everyone else's scores stay hidden until you have scored the episode
    // yourself, or revealed them.
    const revealed =
      ownScore || (isDefined(card.node) && props.revealedMovieIds.has(card.node.workId));
    return {
      card,
      entries,
      revealed,
      scores,
      canScore: card.aired && isDefined(props.currentUserId) && !ownScore,
      canReveal:
        isDefined(card.node) &&
        !revealed &&
        entries.some((entry) => isOthersScore(entry, props.currentUserId)),
      pending: pendingScores.value.has(card.episodeNumber),
      target: targetFor(
        card.node?.review,
        card.episodeNumber,
        () => episodePreview(props.show.data, props.season.seasonNumber, card, scores),
        card.episodeNumber,
      ),
    };
  }),
);

/** The first aired episode the reader has yet to score after the last one
 * they did — where they are in the season. */
const upNext = computed(() => {
  if (!isDefined(props.currentUserId)) return undefined;
  const views = cardViews.value;
  const lastScored = views.findLastIndex((view) => hasOwnScore(view.scores, props.currentUserId));
  return views.slice(lastScored + 1).find((view) => view.canScore)?.card.episodeNumber;
});

const revealEpisode = (card: EpisodeCard) => {
  if (isDefined(card.node)) emit("toggle-reveal", card.node.workId);
};

// -- The details drawer -------------------------------------------------------
// The season and each episode open in the same drawer as movies and books. One
// nobody has scored yet opens as a preview, scored through the show until that
// save lists it — the key stays put, so the drawer switches to the real work in
// place.

const opened = ref<PendingKey>();

interface OpenedWork {
  key: string;
  work: DetailedReviewListItem;
  saveScore?: (score: number) => void;
}

const openedWork = computed<OpenedWork | undefined>(() => {
  const key = opened.value;
  if (key === SEASON) {
    const { work, saveScore } = seasonTarget.value;
    return { key: SEASON, work, saveScore };
  }

  const view = cardViews.value.find((option) => option.card.episodeNumber === key);
  if (!isDefined(view)) return undefined;
  const { work, saveScore } = view.target;
  return { key: `episode-${view.card.episodeNumber}`, work, saveScore };
});
</script>
