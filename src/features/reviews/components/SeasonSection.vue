<template>
  <section>
    <!-- Sticks while its episodes scroll past; the opaque layer underneath
         keeps rows from showing through the translucent tint. -->
    <div class="sticky top-0 z-10 bg-background">
      <div
        class="relative flex min-h-[48px] items-center gap-3 border-t border-white/10 bg-white/5 py-2 pl-3 pr-3 md:gap-4 md:pl-4"
      >
        <mdicon
          name="chevron-right"
          :size="18"
          class="shrink-0 text-white/60 transition-transform duration-base ease-standard"
          :class="open ? 'rotate-90' : ''"
          aria-hidden="true"
        />
        <h3 class="shrink-0 text-[15px] font-semibold">
          <button
            type="button"
            class="after:absolute after:inset-0 after:content-['']"
            :aria-expanded="open"
            :aria-label="`${season.title}, ${rollupLabel(level.scores)}`"
            @click="emit('toggle')"
          >
            {{ season.title }}
          </button>
        </h3>
        <div
          class="hidden h-1 w-20 overflow-hidden rounded-full bg-white/10 md:block"
          aria-hidden="true"
        >
          <div class="h-full rounded-full bg-primary" :style="{ width: `${coveragePercent}%` }" />
        </div>
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
        <span
          class="w-12 shrink-0 text-right font-bold"
          :class="[
            isDefined(level.scores.average) ? 'text-primary' : 'text-gray-500',
            revealed ? '' : 'blur filter',
          ]"
        >
          {{ formatRollup(level.scores) }}
        </span>
      </div>
    </div>

    <div v-if="open" class="animate-fade-up">
      <LevelScore
        label="Season score"
        noun="season"
        :note="ownScoreNote(level, currentUserId, 'episodes')"
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
          :pending="view.pending"
          :score-target="view.target"
          :current-user-id="currentUserId"
          @details="opened = view.card.episodeNumber"
          @reveal="revealEpisode(view.card)"
        />
      </ul>
    </div>

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
  </section>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem, ReviewScores } from "../../../../lib/types/lists";
import { formatTvAddress } from "../../../../lib/types/tv";
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
  formatRollup,
  LevelScores,
  ownScoreNote,
  rollupLabel,
  SeasonNode,
  ShowNode,
} from "../reviewTree";
import EpisodeRow from "./EpisodeRow.vue";
import LevelScore from "./LevelScore.vue";
import ScoreChips from "./ScoreChips.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import { useClubSlug } from "@/service/useClub";
import { OPTIMISTIC_WORK_ID } from "@/service/useList";
import { useSubmitScore } from "@/service/useReviews";
import { useTvSeason } from "@/service/useTMDB";

const props = defineProps<{
  show: ShowNode;
  season: SeasonNode;
  open: boolean;
  members: Member[];
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "toggle-reveal", workId: string): void;
}>();

const isDesktop = useIsDesktop();

// A closed season fetches nothing: a club deep into a long show would
// otherwise pull every season's listing just to draw the headers.
const {
  data: tmdbSeason,
  isLoading: isLoadingEpisodes,
  isError: isEpisodesError,
} = useTvSeason(
  computed(() => props.show.showId),
  computed(() => (props.open ? props.season.seasonNumber : undefined)),
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

/** Where a score entry saves to: the listed work, or through the show. */
const targetFor = (
  review: DetailedReviewListItem | undefined,
  key: PendingKey,
  episodeNumber?: number,
): ScoreTarget => {
  const userId = props.currentUserId;
  if (isDefined(review)) {
    const own = isDefined(userId) ? review.scores[userId] : undefined;
    return { workId: review.id, score: own?.score, reviewId: own?.id };
  }
  return {
    workId: OPTIMISTIC_WORK_ID,
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

/** A season has no work to reveal by until someone scores it on its own, so
 * it reveals by its address instead. */
const revealKey = computed(
  () =>
    props.season.review?.id ??
    formatTvAddress({ showId: props.show.showId, seasonNumber: props.season.seasonNumber }),
);
const revealed = computed(
  () =>
    hasOwnScore(level.value.scores, props.currentUserId) ||
    props.revealedMovieIds.has(revealKey.value),
);

const seasonTarget = computed(() => targetFor(props.season.review, SEASON));

const coveragePercent = computed(() =>
  props.season.episodeCount === 0
    ? 0
    : Math.round((props.season.scoredCount / props.season.episodeCount) * 100),
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
      target: targetFor(card.node?.review, card.episodeNumber, card.episodeNumber),
    };
  }),
);

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
    const { review } = props.season;
    if (isDefined(review)) return { key: SEASON, work: review };
    return {
      key: SEASON,
      work: seasonPreview(props.show.data, props.season, tmdbSeason.value, withPending({}, SEASON)),
      saveScore: scoreThroughShow(),
    };
  }

  const view = cardViews.value.find((option) => option.card.episodeNumber === key);
  if (!isDefined(view)) return undefined;
  const episodeKey = `episode-${view.card.episodeNumber}`;
  if (isDefined(view.card.node)) return { key: episodeKey, work: view.card.node.review };
  return {
    key: episodeKey,
    work: episodePreview(props.show.data, props.season.seasonNumber, view.card, view.scores),
    saveScore: view.target.saveScore,
  };
});
</script>
