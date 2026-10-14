<template>
  <article
    ref="card"
    class="scroll-mt-4 rounded-lg border border-white/10 bg-white/[0.03] text-left"
    :class="justAdded ? 'animate-just-added' : ''"
  >
    <div class="relative isolate flex items-center gap-3 p-3 md:gap-5">
      <img
        v-if="hasValue(show.imageUrl)"
        v-lazy-load
        :src="show.imageUrl"
        alt=""
        class="h-[84px] w-14 shrink-0 rounded-md object-cover md:h-24 md:w-16"
      />
      <div
        v-else
        class="bg-lowBackground flex h-[84px] w-14 shrink-0 items-center justify-center rounded-md md:h-24 md:w-16"
      >
        <mdicon name="television-classic" class="text-slate-500" />
      </div>

      <div class="flex min-w-0 flex-grow flex-col gap-1">
        <!-- The title is the row's button; its ::after stretches over the
             whole header so anywhere on it opens the show. It sits at z-10
             because the rotated chevron, blurred score and fading poster
             each paint above an unraised overlay and swallow the click; the
             show's own actions sit at z-20 above it. -->
        <h2 class="text-base leading-snug font-semibold md:text-lg">
          <button
            type="button"
            class="line-clamp-2 text-left after:absolute after:inset-0 after:z-10 after:content-['']"
            :aria-expanded="open"
            :aria-label="
              isScoreHidden
                ? `${show.title}, scores hidden`
                : `${show.title}, ${rollupLabel(show.scores)}`
            "
            @click="emit('toggle')"
          >
            {{ show.title }}
          </button>
        </h2>
        <span v-if="hasValue(show.metaLine)" class="text-xs text-gray-400 md:text-sm">
          {{ show.metaLine }}
        </span>
        <div class="flex items-center gap-2">
          <div class="h-1 w-16 overflow-hidden rounded-full bg-white/10 md:w-28" aria-hidden="true">
            <div
              class="bg-primary h-full rounded-full"
              :style="{ width: `${coveragePercent(show.scoredCount, show.episodeCount)}%` }"
            />
          </div>
          <span class="text-xs text-white/55">
            {{ coverageLabel(show.scoredCount, show.episodeCount) }}
          </span>
        </div>

        <!-- The show is scored from its own card, the way an episode is
             scored from its row. -->
        <div class="relative z-20 mt-1 flex flex-wrap items-center gap-2">
          <button
            v-if="isDefined(currentUserId)"
            type="button"
            class="duration-fast ease-standard flex items-center gap-1.5 rounded-full py-1 pr-3 pl-2 text-sm font-medium transition active:scale-95"
            :class="
              isDefined(ownShowScore)
                ? 'bg-white/5 text-gray-200 ring-1 ring-white/10 ring-inset hover:bg-white/10'
                : 'bg-primary/15 text-primary ring-primary/40 hover:bg-primary/25 ring-1 ring-inset'
            "
            :aria-label="
              isDefined(ownShowScore)
                ? `Your score for ${show.title}, ${ownShowScore.score}. Change it`
                : `Rate ${show.title}`
            "
            @click="rating = true"
          >
            <template v-if="isDefined(ownShowScore)">
              <mdicon name="star" :size="16" class="text-primary" />
              <span>Your score</span>
              <span class="font-bold text-white">{{ ownShowScore.score }}</span>
            </template>
            <template v-else>
              <mdicon name="star-outline" :size="16" />
              <span>Rate show</span>
            </template>
          </button>
          <button
            type="button"
            class="duration-fast ease-standard flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
            :aria-label="`${show.title} details`"
            @click="detailsOpen = true"
          >
            <mdicon name="comment-text-outline" :size="16" />
            <span class="hidden sm:inline">Details</span>
          </button>
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
          class="text-2xl leading-tight font-bold"
          :class="[
            isDefined(show.scores.average) ? 'text-primary' : 'text-gray-500',
            isScoreHidden ? 'blur filter' : '',
          ]"
          :aria-hidden="isScoreHidden"
        >
          {{ formatRollup(show.scores) }}
        </div>
        <div class="text-[11px] text-white/55">club avg</div>
      </div>
      <mdicon
        name="chevron-down"
        :size="22"
        class="duration-base ease-standard shrink-0 text-white/60 transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </div>

    <div v-if="open" class="animate-fade-up border-t border-white/10">
      <SeasonTabs
        v-if="show.seasons.length > 0"
        v-model="selectedSeason"
        :show-id="show.showId"
        :seasons="show.seasons"
      />
      <p v-else class="py-3 pl-3 text-sm text-gray-400 md:pl-6">
        This show's seasons haven't loaded yet.
      </p>

      <SeasonSection
        v-if="isDefined(selectedSeasonNode)"
        :key="selectedSeasonNode.seasonNumber"
        :show="show"
        :season="selectedSeasonNode"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRated"
        :current-user-id="currentUserId"
        @toggle-reveal="emit('toggle-reveal', $event)"
      />
    </div>

    <!-- Teleported: an overlay inside the expanded panel would be
         positioned against its mount animation's transform, not the screen. -->
    <Teleport to="body">
      <WorkDetailsDrawer
        v-if="detailsOpen"
        :movie="show.review"
        :members="members"
        :delete-review="deleteReview"
        :revealed-movie-ids="revealedMovieIds"
        :has-rated="hasRatedShow"
        :current-user-id="currentUserId"
        :shown-entries="entries"
        @toggle-reveal="emit('toggle-reveal', $event)"
        @close="detailsOpen = false"
      />
      <ScoreEntryModal
        v-if="rating"
        :target="show.review"
        :score="ownShowScore?.score"
        :review-id="ownShowScore?.id"
        @close="rating = false"
      />
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";

import { hasValue, isDefined } from "../../../../../lib/checks/checks.js";
import { Member } from "../../../../../lib/types/club";
import { hasOwnScore, scoreEntries } from "../../reviewScores";
import {
  coverageLabel,
  coveragePercent,
  currentSeasonNumber,
  formatRollup,
  rollupLabel,
  ShowNode,
} from "../../reviewTree";
import ScoreChips from "../ScoreChips.vue";
import ScoreEntryModal from "../ScoreEntryModal.vue";
import WorkDetailsDrawer from "../WorkDetailsDrawer.vue";
import SeasonSection from "./SeasonSection.vue";
import SeasonTabs from "./SeasonTabs.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  show: ShowNode;
  open: boolean;
  /** Glows once on arrival, for a show the reader has just added. */
  justAdded?: boolean;
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

const detailsOpen = ref(false);
const rating = ref(false);

defineExpose({
  workId: computed(() => props.show.workId),
  openDetails: () => {
    detailsOpen.value = true;
  },
});

/** The score the reader set on the show itself, not one averaged from their
 * episodes. */
const ownShowScore = computed(() =>
  isDefined(props.currentUserId) ? props.show.review.scores[props.currentUserId] : undefined,
);

// A show lands open at the top of the list, above whatever the reader was
// looking at; the browser's scroll anchoring would otherwise keep that in view
// and push the new show off the top of the screen.
const card = useTemplateRef<HTMLElement>("card");
onMounted(() => {
  if (props.justAdded) card.value?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const selectedSeason = ref(currentSeasonNumber(props.show) ?? 0);
const selectedSeasonNode = computed(
  () =>
    props.show.seasons.find((season) => season.seasonNumber === selectedSeason.value) ??
    props.show.seasons[0],
);

const entries = computed(() =>
  scoreEntries(props.show.scores, props.members, props.show.averagedMemberIds),
);
const memberEntries = computed(() => entries.value.filter((entry) => isDefined(entry.memberId)));

const revealed = computed(
  () =>
    hasOwnScore(props.show.scores, props.currentUserId) ||
    props.revealedMovieIds.has(props.show.workId),
);
const isScoreHidden = computed(() => !revealed.value && isDefined(props.show.scores.average));

/** The drawer reveals the show on the same terms as its card: a score of the
 * reader's anywhere in the show, not only one set on the show itself. */
const hasRatedShow = (workId: string) =>
  workId === props.show.workId
    ? hasOwnScore(props.show.scores, props.currentUserId)
    : props.hasRated(workId);
</script>
