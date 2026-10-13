<template>
  <section
    :id="seasonPanelId(show.showId, season.seasonNumber)"
    role="tabpanel"
    :aria-labelledby="seasonTabId(show.showId, season.seasonNumber)"
    class="animate-fade-up"
  >
    <!-- The season in a line: each member's average over the episodes they
         scored, and the club's mean of those. A season is never scored on
         its own. -->
    <div
      role="group"
      :aria-label="`${season.title} scores`"
      class="flex flex-wrap items-center gap-x-3 gap-y-2 bg-white/[0.02] py-2.5 pl-3 pr-2 md:gap-x-4 md:pl-11 md:pr-3"
    >
      <h3 class="text-sm font-semibold">{{ season.title }}</h3>
      <span class="flex-grow text-xs text-white/55">
        {{ coverageLabel(season.scoredCount, season.episodeCount) }}
      </span>
      <ScoreChips
        v-if="isDesktop && memberEntries.length > 0"
        class="justify-end"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <button
        v-if="canReveal"
        type="button"
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition duration-fast ease-standard hover:bg-white/10 hover:text-gray-200"
        :aria-label="`Reveal ${season.title} scores`"
        @click="emit('toggle-reveal', revealKey)"
      >
        <mdicon name="eye-outline" :size="18" />
      </button>
      <span
        class="w-10 shrink-0 text-right font-bold"
        :class="[
          isDefined(season.scores.average) ? 'text-primary' : 'text-gray-500',
          revealed || !isDefined(season.scores.average) ? '' : 'blur filter',
        ]"
        :aria-hidden="(!revealed && isDefined(season.scores.average)) || undefined"
      >
        {{ formatRollup(season.scores) }}
      </span>
      <!-- Holds the episode rows' action column, so the season's average
           lines up with theirs. -->
      <span class="w-10 shrink-0" aria-hidden="true" />
      <ScoreChips
        v-if="!isDesktop && memberEntries.length > 0"
        class="w-full"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
    </div>

    <p
      v-if="cards.length === 0 && isLoadingEpisodes"
      class="px-3 py-3 text-sm text-gray-400 md:pl-11"
      role="status"
    >
      Loading episodes…
    </p>
    <p
      v-else-if="cards.length === 0 && isEpisodesError"
      class="px-3 py-3 text-sm text-gray-400 md:pl-11"
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
        :up-next="view.card.episodeNumber === upNext"
        :pending="view.pending"
        :score-target="view.target"
        :current-user-id="currentUserId"
        @details="opened = view.card.episodeNumber"
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
import { buildEpisodeCards, episodePreview, ScoreTarget, withMemberScore } from "../episodeCards";
import { hasOwnScore, isOthersScore, scoreEntries } from "../reviewScores";
import {
  coverageLabel,
  formatRollup,
  SeasonNode,
  seasonPanelId,
  seasonRevealKey,
  seasonTabId,
  ShowNode,
} from "../reviewTree";
import EpisodeRow from "./EpisodeRow.vue";
import ScoreChips from "./ScoreChips.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
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

const isDesktop = useIsDesktop();

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
// An episode nobody has scored has no work on the reviews list for the usual
// optimistic update to write into, so a save shows here, keyed by the episode
// number, until the refetched list carries it.

const pendingScores = ref(new Map<number, number>());

const markPending = (key: number, score: number) => {
  pendingScores.value = new Map([...pendingScores.value, [key, score]]);
  return () => {
    // A later save on the same work owns the entry now; leave it be.
    if (pendingScores.value.get(key) !== score) return;
    pendingScores.value = new Map([...pendingScores.value].filter(([other]) => other !== key));
  };
};

/** `scores` with the reader's in-flight save written in, if they have one. */
const withPending = (scores: ReviewScores, key: number) => {
  const pending = pendingScores.value.get(key);
  const userId = props.currentUserId;
  return isDefined(pending) && isDefined(userId)
    ? withMemberScore(scores, userId, pending)
    : scores;
};

const clubSlug = useClubSlug();
const submitScore = useSubmitScore(clubSlug);

/** Saves a score on an episode that is not a work yet, through the show. */
const scoreThroughShow = (episodeNumber: number) => (score: number) => {
  const settle = markPending(episodeNumber, score);
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
  episodeNumber: number,
  preview: () => DetailedReviewListItem,
): ScoreTarget => {
  const userId = props.currentUserId;
  if (isDefined(review)) {
    const own = isDefined(userId) ? review.scores[userId] : undefined;
    return { work: review, score: own?.score, reviewId: own?.id };
  }
  return {
    work: preview(),
    score: pendingScores.value.get(episodeNumber),
    saveScore: scoreThroughShow(episodeNumber),
  };
};

// -- The season's scores -------------------------------------------------------

// Every member's number here is an average, so each reads to one decimal.
const memberEntries = computed(() =>
  scoreEntries(props.season.scores, props.members)
    .filter((entry) => isDefined(entry.memberId))
    .map((entry) => ({ ...entry, value: Number(entry.value.toFixed(1)) })),
);

const revealKey = computed(() => seasonRevealKey(props.show.showId, props.season));
const revealed = computed(
  () =>
    hasOwnScore(props.season.scores, props.currentUserId) ||
    props.revealedMovieIds.has(revealKey.value),
);
const canReveal = computed(
  () =>
    !revealed.value &&
    memberEntries.value.some((entry) => isOthersScore(entry, props.currentUserId)),
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
      pending: pendingScores.value.has(card.episodeNumber),
      target: targetFor(card.node?.review, card.episodeNumber, () =>
        episodePreview(props.show.data, props.season.seasonNumber, card, scores),
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

// -- The details drawer -------------------------------------------------------
// An episode opens in the same drawer as movies and books, score entry and
// all. One nobody has scored yet opens as a preview, scored through the show
// until that save lists it — the key stays put, so the drawer switches to the
// real work in place.

const opened = ref<number>();

interface OpenedWork {
  key: string;
  work: DetailedReviewListItem;
  saveScore?: (score: number) => void;
}

const openedWork = computed<OpenedWork | undefined>(() => {
  const view = cardViews.value.find((option) => option.card.episodeNumber === opened.value);
  if (!isDefined(view)) return undefined;
  const { work, saveScore } = view.target;
  return { key: `episode-${view.card.episodeNumber}`, work, saveScore };
});
</script>
