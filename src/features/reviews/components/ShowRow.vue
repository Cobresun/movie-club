<template>
  <article class="rounded-lg border border-white/10 bg-white/[0.03] text-left">
    <div class="relative flex items-center gap-3 p-2.5 md:gap-5 md:p-3">
      <img
        v-if="hasValue(show.imageUrl)"
        v-lazy-load
        :src="show.imageUrl"
        alt=""
        class="h-[66px] w-11 shrink-0 rounded-md object-cover md:h-[84px] md:w-14"
      />
      <div
        v-else
        class="flex h-[66px] w-11 shrink-0 items-center justify-center rounded-md bg-lowBackground md:h-[84px] md:w-14"
      >
        <mdicon name="television-classic" class="text-slate-500" />
      </div>

      <div class="flex min-w-0 flex-grow flex-col gap-1">
        <!-- The title is the row's button; its ::after stretches over the
             whole header so anywhere on it opens the show. -->
        <h2 class="text-base font-semibold leading-snug md:text-lg">
          <button
            type="button"
            class="text-left after:absolute after:inset-0 after:content-['']"
            :aria-expanded="open"
            :aria-label="`${show.title}, ${rollupLabel(show.scores)}`"
            @click="emit('toggle', expansionKey(show.showId))"
          >
            {{ show.title }}
          </button>
        </h2>
        <span v-if="hasValue(show.metaLine)" class="text-xs text-gray-400 md:text-sm">
          {{ show.metaLine }}
        </span>
        <div class="flex items-center gap-2">
          <div class="h-1 w-16 overflow-hidden rounded-full bg-white/10 md:w-28" aria-hidden="true">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${coveragePercent}%` }" />
          </div>
          <span class="text-xs text-white/55">
            {{ coverageLabel(show.scoredCount, show.episodeCount) }}
          </span>
        </div>
      </div>

      <ScoreChips
        v-if="isDesktop && memberEntries.length > 0"
        class="max-w-sm justify-end"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <div class="shrink-0 text-right">
        <div
          class="text-2xl font-bold leading-tight"
          :class="[
            isDefined(show.scores.average) ? 'text-primary' : 'text-gray-500',
            revealed || !isDefined(show.scores.average) ? '' : 'blur filter',
          ]"
        >
          {{ formatRollup(show.scores) }}
        </div>
        <div class="text-[11px] text-white/55">club avg</div>
      </div>
      <mdicon
        name="chevron-down"
        :size="22"
        class="shrink-0 text-white/60 transition-transform duration-base ease-standard"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </div>

    <div v-if="open" class="animate-fade-up border-t border-white/10">
      <LevelScore
        label="Show score"
        noun="show"
        :note="ownScoreNote(show, currentUserId, 'seasons')"
        :entries="entries"
        :revealed="revealed"
        :target="showTarget"
        :current-user-id="currentUserId"
        @reveal="emit('toggle-reveal', show.workId)"
        @details="detailsOpen = true"
      />

      <p v-if="show.seasons.length === 0" class="px-3 pb-3 text-sm text-gray-400 md:pl-11">
        This show's seasons haven't loaded yet.
      </p>
      <SeasonSection
        v-for="season in show.seasons"
        :key="season.seasonNumber"
        :show="show"
        :season="season"
        :open="expanded.has(expansionKey(show.showId, season.seasonNumber))"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRated"
        :current-user-id="currentUserId"
        @toggle="emit('toggle', expansionKey(show.showId, season.seasonNumber))"
        @toggle-reveal="emit('toggle-reveal', $event)"
      />
    </div>

    <WorkDetailsDrawer
      v-if="detailsOpen"
      :movie="show.review"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @toggle-reveal="emit('toggle-reveal', $event)"
      @close="detailsOpen = false"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { hasOwnScore, scoreEntries } from "../reviewScores";
import {
  coverageLabel,
  expansionKey,
  formatRollup,
  ownScoreNote,
  rollupLabel,
  ShowNode,
} from "../reviewTree";
import LevelScore from "./LevelScore.vue";
import ScoreChips from "./ScoreChips.vue";
import SeasonSection from "./SeasonSection.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  show: ShowNode;
  /** The shows and seasons the reader has open, by `expansionKey`. */
  expanded: ReadonlySet<string>;
  members: Member[];
  deleteReview: (workId: string) => void;
  revealedMovieIds: Set<string>;
  hasRated: (workId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle", key: string): void;
  (e: "toggle-reveal", workId: string): void;
}>();

const isDesktop = useIsDesktop();

const open = computed(() => props.expanded.has(expansionKey(props.show.showId)));
const detailsOpen = ref(false);

const entries = computed(() =>
  scoreEntries(props.show.scores, props.members, props.show.averagedMemberIds),
);
const memberEntries = computed(() => entries.value.filter((entry) => isDefined(entry.memberId)));

const revealed = computed(
  () =>
    hasOwnScore(props.show.scores, props.currentUserId) ||
    props.revealedMovieIds.has(props.show.workId),
);

// The show is always on the reviews list, so its score saves to it directly —
// and only a score set on the show itself is the reader's to edit or remove.
const showTarget = computed(() => {
  const userId = props.currentUserId;
  const own = isDefined(userId) ? props.show.review.scores[userId] : undefined;
  return { workId: props.show.workId, score: own?.score, reviewId: own?.id };
});

const coveragePercent = computed(() =>
  props.show.episodeCount === 0
    ? 0
    : Math.round((props.show.scoredCount / props.show.episodeCount) * 100),
);
</script>
